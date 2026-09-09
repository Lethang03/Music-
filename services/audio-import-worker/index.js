import { createClient } from '@supabase/supabase-js'
import { createWriteStream, createReadStream, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename, extname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
const supabase = createClient(url, key, { auth: { persistSession: false } })
const pollMs = Number(process.env.IMPORT_POLL_MS || 3000)
const maxBytes = Number(process.env.MAX_IMPORT_BYTES || 524288000)
const audioExtensions = /\.(mp3|wav|m4a|aac|ogg|opus|flac|webm)$/i

const run = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk })
  child.on('error', reject)
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} failed: ${stderr.slice(-600) || `exit ${code}`}`)))
})
const getJson = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; let err = ''
  child.stdout.on('data', c => out += c); child.stderr.on('data', c => err += c)
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err.slice(-600) || `${command} failed`)))
})
async function update(job, values) {
  const { error } = await supabase.from('import_jobs').update(values).eq('id', job.id).neq('status', 'cancelled')
  if (error) throw error
  const { data } = await supabase.from('import_jobs').select('status').eq('id', job.id).single()
  if (data?.status === 'cancelled') throw new Error('Import cancelled.')
}
function safeName(value) { return String(value || 'track').replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'track' }
async function download(source, destination) {
  const response = await fetch(source, { redirect: 'follow', signal: AbortSignal.timeout(120000) })
  if (!response.ok || !response.body) throw new Error(`Source download failed (${response.status}).`)
  const length = Number(response.headers.get('content-length') || 0)
  if (length > maxBytes) throw new Error('Source exceeds the 500 MB import limit.')
  let written = 0
  const meter = new TransformStream({ transform(chunk, controller) { written += chunk.byteLength; if (written > maxBytes) throw new Error('Source exceeds the 500 MB import limit.'); controller.enqueue(chunk) } })
  await pipeline(Readable.fromWeb(response.body.pipeThrough(meter)), createWriteStream(destination))
}
async function durationSeconds(file) {
  const data = await getJson('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file])
  return Math.max(0, Math.round(Number(data?.format?.duration || 0)))
}
async function process(job) {
  const folder = join(tmpdir(), `soundverse-import-${job.id}-${randomUUID()}`)
  await fs.mkdir(folder, { recursive: true })
  try {
    let input; let info = job.metadata || {}
    await update(job, { progress: 12 })
    if (job.source_type === 'upload') {
      const [, , bucket, ...parts] = job.source_url.split('/')
      const storagePath = parts.join('/')
      const { data, error } = await supabase.storage.from(bucket).download(storagePath)
      if (error) throw new Error(`Staged upload is unavailable: ${error.message}`)
      input = join(folder, `source${extname(storagePath) || '.bin'}`); await fs.writeFile(input, Buffer.from(await data.arrayBuffer()))
    } else if (job.source_type === 'video') {
      info = await getJson('yt-dlp', ['--no-playlist', '--dump-single-json', job.source_url], folder)
      await update(job, { progress: 28, metadata: { ...job.metadata, title: info.title, artist: info.artist || info.uploader, album: info.album, genre: info.categories?.[0], thumbnail: info.thumbnail } })
      await run('yt-dlp', ['--no-playlist', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '2', '--output', 'source.%(ext)s', job.source_url], folder)
      input = join(folder, 'source.mp3')
    } else {
      const suffix = audioExtensions.test(new URL(job.source_url).pathname) ? extname(new URL(job.source_url).pathname) : '.bin'
      input = join(folder, `source${suffix}`); await download(job.source_url, input)
    }
    await update(job, { progress: 48 })
    const output = join(folder, 'processed.mp3')
    await run('ffmpeg', ['-y', '-i', input, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', output], folder)
    const duration = await durationSeconds(output)
    const title = info.title || basename(job.source_url).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Imported Track'
    const metadata = { ...job.metadata, ...info, title, artist: info.artist || info.uploader || job.metadata?.artist || 'Unknown Artist', duration }
    await update(job, { status: 'uploading', progress: 70, metadata })
    const audioPath = `audio/imports/${job.id}-${safeName(title)}.mp3`
    const { error: audioError } = await supabase.storage.from('soundverse').upload(audioPath, createReadStream(output), { contentType: 'audio/mpeg', upsert: false })
    if (audioError) throw new Error(`Audio upload failed: ${audioError.message}`)
    const { data: publicAudio } = supabase.storage.from('soundverse').getPublicUrl(audioPath)
    let coverUrl = job.metadata?.cover_url || null
    if (info.thumbnail) {
      try { const cover = join(folder, 'cover.jpg'); await download(info.thumbnail, cover); const coverPath = `covers/imports/${job.id}.jpg`; const { error } = await supabase.storage.from('soundverse').upload(coverPath, createReadStream(cover), { contentType: 'image/jpeg' }); if (!error) coverUrl = supabase.storage.from('soundverse').getPublicUrl(coverPath).data.publicUrl } catch { /* cover is optional */ }
    }
    await update(job, { progress: 90, metadata })
    const { data: track, error: trackError } = await supabase.from('music_tracks').insert({ title, artist: metadata.artist, album: metadata.album || null, genre: metadata.genre || null, cover_url: coverUrl, audio_url: publicAudio.publicUrl, duration, published: true, owner_id: job.created_by }).select().single()
    if (trackError) throw new Error(`Track creation failed: ${trackError.message}`)
    await supabase.from('import_jobs').update({ status: 'completed', progress: 100, track_id: track.id, metadata, completed_at: new Date().toISOString(), error_message: null }).eq('id', job.id)
  } catch (error) {
    if (!String(error.message).includes('cancelled')) await supabase.from('import_jobs').update({ status: 'failed', progress: 0, error_message: error.message.slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', job.id).neq('status', 'cancelled')
  } finally { await fs.rm(folder, { recursive: true, force: true }) }
}
async function tick() {
  const { data, error } = await supabase.rpc('claim_audio_import_job')
  if (error) throw error
  if (data?.[0]) await process(data[0])
}
async function loop() { try { await tick() } catch (error) { console.error('Worker poll failed:', error.message) } finally { setTimeout(loop, pollMs) } }
loop()
