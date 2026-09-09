import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import ffmpegStatic from 'ffmpeg-static'
import { createReadStream, createWriteStream, promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url) {
  console.error('\n❌ ERROR: SUPABASE_URL is missing in environment or .env file.')
  console.error('Please add it to .env: SUPABASE_URL=https://your-project.supabase.co\n')
  process.exit(1)
}
if (!key) {
  console.error('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in environment or .env file.')
  console.error('Please add it to .env: SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })
const pollMs = Number(process.env.IMPORT_POLL_MS || 3000)
const maxBytes = Number(process.env.MAX_IMPORT_BYTES || 524288000)
const require = createRequire(import.meta.url)
const bundledYtDlp = join(dirname(dirname(require.resolve('yt-dlp-exec'))), 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
const ytDlp = process.env.YT_DLP_BIN || bundledYtDlp || 'yt-dlp'
const ffmpeg = process.env.FFMPEG_BIN || ffmpegStatic || 'ffmpeg'
const ffprobe = process.env.FFPROBE_BIN || 'ffprobe'
const audioExtensions = /\.(mp3|wav|m4a|aac|ogg|opus|flac|webm)$/i

function log(job, message, extra = {}) {
  console.log(JSON.stringify({ service: 'audio-worker', job_id: job.id, message, ...extra }))
}

function run(command, args, cwd, parseJson = false, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', error => reject(new Error(`Unable to start ${command}: ${error.message}`)))
    child.once('close', code => {
      if (code !== 0) return reject(new Error(`${command} failed: ${stderr.trim().slice(-1000) || `exit ${code}`}`))
      if (!parseJson) return resolve()
      try { resolve(JSON.parse(stdout)) } catch { reject(new Error(`${command} returned invalid metadata.`)) }
    })
  })
}

async function ensureActive(job) {
  const { data, error } = await supabase.from('import_jobs').select('status').eq('id', job.id).single()
  if (error) throw error
  if (data.status === 'cancelled') throw new Error('Import cancelled.')
}

async function update(job, values) {
  const { error } = await supabase.from('import_jobs').update(values).eq('id', job.id).neq('status', 'cancelled')
  if (error) throw error
  await ensureActive(job)
}

function safeName(value) {
  return String(value || 'track').replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'track'
}

async function download(source, destination) {
  const response = await fetch(source, { redirect: 'follow', signal: AbortSignal.timeout(120000) })
  if (!response.ok || !response.body) throw new Error(`Source download failed (${response.status}).`)
  if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new Error('Source exceeds the 500 MB import limit.')
  let written = 0
  const meter = new TransformStream({
    transform(chunk, controller) {
      written += chunk.byteLength
      if (written > maxBytes) throw new Error('Source exceeds the 500 MB import limit.')
      controller.enqueue(chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body.pipeThrough(meter)), createWriteStream(destination))
}

async function durationSeconds(file, job) {
  try {
    const probe = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], dirname(file), true)
    return Math.max(0, Math.round(Number(probe?.format?.duration || 0)))
  } catch (error) {
    // ffmpeg-static ships ffmpeg but not always ffprobe. Duration is useful
    // metadata, never a reason to fail an otherwise valid import.
    log(job, 'Duration probe unavailable; continuing', { error: String(error.message || error) })
    return 0
  }
}

async function processJob(job) {
  const folder = join(tmpdir(), `music-gg-import-${job.id}-${randomUUID()}`)
  await fs.mkdir(folder, { recursive: true })
  let audioPath
  try {
    let input; let info = job.metadata || {}
    log(job, 'Processing URL', { url: job.source_url })
    await ensureActive(job)

    if (job.source_type === 'upload') {
      const match = /^storage:\/\/([^/]+)\/(.+)$/.exec(job.source_url)
      if (!match) throw new Error('Invalid staged upload URL.')
      const { data, error } = await supabase.storage.from(match[1]).download(match[2])
      if (error || !data) throw new Error(`Staged upload is unavailable: ${error?.message || 'not found'}`)
      input = join(folder, `source${extname(match[2]) || '.bin'}`)
      await fs.writeFile(input, Buffer.from(await data.arrayBuffer()))
    } else if (job.source_type === 'video') {
      log(job, 'Extracting audio', { url: job.source_url })
      await update(job, { status: 'extracting', progress: 25 })
      const ytdlpBaseArgs = ['--no-playlist', '--no-warnings', '--ffmpeg-location', ffmpeg]
      
      try {
        info = await run(ytDlp, [...ytdlpBaseArgs, '--dump-single-json', job.source_url], folder, true)
      } catch (err) {
        throw new Error(`Failed to extract video metadata: ${err.message}`)
      }
      
      await update(job, { status: 'extracting', progress: 40, metadata: { ...job.metadata, title: info.title, artist: info.artist || info.uploader, album: info.album, genre: info.categories?.[0], thumbnail: info.thumbnail } })
      
      try {
        await run(ytDlp, [...ytdlpBaseArgs, '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0', '--output', 'source.%(ext)s', job.source_url], folder)
      } catch (err) {
        throw new Error(`Failed to extract audio from video: ${err.message}`)
      }
      input = join(folder, 'source.mp3')
    } else {
      log(job, 'downloading')
      await update(job, { status: 'extracting', progress: 25 })
      const sourcePath = new URL(job.source_url).pathname
      input = join(folder, `source${audioExtensions.test(sourcePath) ? extname(sourcePath) : '.bin'}`)
      await download(job.source_url, input)
    }

    log(job, 'Converting audio')
    await update(job, { status: 'extracting', progress: 55 })
    const output = join(folder, 'processed.mp3')
    await run(ffmpeg, ['-y', '-i', input, '-vn', '-codec:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', output], folder)
    const duration = await durationSeconds(output, job)
    const title = info.title || basename(job.source_url).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') || 'Imported Track'
    const metadata = { ...job.metadata, ...info, title, artist: info.artist || info.uploader || job.metadata?.artist || 'Unknown Artist', duration }

    await update(job, { status: 'uploading', progress: 70, metadata })
    audioPath = `audio/imports/${job.id}-${safeName(title)}.mp3`
    log(job, 'Uploading file', { path: audioPath })
    const { error: uploadError } = await supabase.storage.from('soundverse').upload(audioPath, createReadStream(output), { contentType: 'audio/mpeg', upsert: false })
    if (uploadError && !/already exists/i.test(uploadError.message)) throw new Error(`Audio upload failed: ${uploadError.message}`)
    const audioUrl = supabase.storage.from('soundverse').getPublicUrl(audioPath).data.publicUrl

    await update(job, { status: 'uploading', progress: 90, metadata })
    // The unique import_job_id index makes a crash/retry unable to create duplicate tracks.
    const { data: existing, error: existingError } = await supabase.from('music_tracks').select('id').eq('import_job_id', job.id).maybeSingle()
    if (existingError) throw new Error(`Track lookup failed: ${existingError.message}`)
    let track = existing
    if (!track) {
      const { data, error } = await supabase.from('music_tracks').insert({ title, artist: metadata.artist, album: metadata.album || null, genre: metadata.genre || null, cover_url: job.metadata?.cover_url || null, audio_url: audioUrl, duration, published: true, owner_id: job.created_by, import_job_id: job.id }).select('id').single()
      if (error) throw new Error(`Track creation failed: ${error.message}`)
      track = data
    }
    if (!track?.id) throw new Error('Track creation failed: no track was returned.')

    await update(job, { status: 'completed', progress: 100, track_id: track.id, metadata, completed_at: new Date().toISOString(), error_message: null })
    log(job, 'Completed', { track_id: track.id })
  } catch (error) {
    log(job, 'Failed', { error: String(error.message || error) })
    if (error.message !== 'Import cancelled.') {
      const { error: saveError } = await supabase.from('import_jobs').update({ status: 'failed', progress: 0, error_message: String(error.message).slice(0, 1000), completed_at: new Date().toISOString() }).eq('id', job.id).neq('status', 'cancelled')
      if (saveError) console.error(`Unable to mark job ${job.id} failed:`, saveError.message)
    }
  } finally {
    await fs.rm(folder, { recursive: true, force: true })
  }
}

async function tick() {
  // This SQL RPC uses FOR UPDATE SKIP LOCKED and changes pending -> processing atomically.
  const { data, error } = await supabase.rpc('claim_audio_import_job')
  if (error) throw error
  if (data?.[0]) {
    log(data[0], 'Found job', { source_type: data[0].source_type, url: data[0].source_url })
    await processJob(data[0])
  }
}

let isShuttingDown = false

async function loop() {
  if (isShuttingDown) return
  try { await tick() } catch (error) { console.error('Worker poll failed:', error.message) }
  if (!isShuttingDown) setTimeout(loop, pollMs)
}

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...')
  isShuttingDown = true
})
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...')
  isShuttingDown = true
})

console.log(`Audio worker started; polling every ${pollMs}ms.`)
console.log('Health: OK. Ready to process jobs.')
loop()
