import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

let url = ''
let key = ''

if (fs.existsSync('workers/audio-worker/.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('workers/audio-worker/.env'))
  url = envConfig.SUPABASE_URL
  key = envConfig.SUPABASE_SERVICE_ROLE_KEY
}

if (!url || !key) {
  dotenv.config()
  url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
}

console.log('Connecting to:', url)
console.log('Using key starting with:', key ? key.slice(0, 15) : 'none')

const supabase = createClient(url, key, {
  auth: { persistSession: false }
})

async function inspect() {
  // 1. List buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
  if (bErr) {
    console.error('Bucket list error:', bErr.message)
  } else {
    console.log('Buckets:', buckets?.map(b => ({ name: b.name, public: b.public })))
  }

  // 2. Query tracks
  const { data: tracks, error: tErr } = await supabase.from('tracks').select('id, title, artist, audio_url, cover_url, duration, file_size, created_at')
  if (tErr) {
    console.error('Tracks error:', tErr.message)
  } else {
    console.log(`Total tracks in DB: ${tracks?.length || 0}`)
    const audioUrlCounts = new Map()
    const titleCounts = new Map()
    for (const t of (tracks || [])) {
      if (t.audio_url) {
        audioUrlCounts.set(t.audio_url, (audioUrlCounts.get(t.audio_url) || []).concat(t))
      }
      if (t.title) {
        const normTitle = `${t.title}__${t.artist || ''}`.toLowerCase().trim()
        titleCounts.set(normTitle, (titleCounts.get(normTitle) || []).concat(t))
      }
    }
    const dupAudioUrls = Array.from(audioUrlCounts.entries()).filter(([_, list]) => list.length > 1)
    const dupTitles = Array.from(titleCounts.entries()).filter(([_, list]) => list.length > 1)
    console.log(`Tracks with identical audio_url: ${dupAudioUrls.length}`)
    for (const [u, list] of dupAudioUrls) {
      console.log(`  Audio URL: ${u} -> Used by ${list.length} tracks:`, list.map(x => `"${x.title}" (${x.id})`))
    }
    console.log(`Tracks with identical title + artist: ${dupTitles.length}`)
    for (const [title, list] of dupTitles) {
      console.log(`  Track: "${title}" -> ${list.length} records:`, list.map(x => `id: ${x.id}, audio: ${x.audio_url}`))
    }

    console.log('\n--- Sample Tracks ---')
    for (const t of (tracks || []).slice(0, 10)) {
      console.log(`- "${t.title}" by "${t.artist}" | audio: ${t.audio_url}`)
    }
  }

  // 3. Query podcast episodes
  const { data: episodes, error: epErr } = await supabase.from('podcast_episodes').select('id, podcast_id, title, audio_url, duration, created_at')
  if (epErr) {
    console.error('Episodes error:', epErr.message)
  } else {
    console.log(`\nTotal podcast episodes in DB: ${episodes?.length || 0}`)
    const epAudioCounts = new Map()
    const epTitleCounts = new Map()
    for (const ep of (episodes || [])) {
      if (ep.audio_url) {
        epAudioCounts.set(ep.audio_url, (epAudioCounts.get(ep.audio_url) || []).concat(ep))
      }
      if (ep.title) {
        const norm = ep.title.toLowerCase().trim()
        epTitleCounts.set(norm, (epTitleCounts.get(norm) || []).concat(ep))
      }
    }
    const dupEpUrls = Array.from(epAudioCounts.entries()).filter(([_, list]) => list.length > 1)
    const dupEpTitles = Array.from(epTitleCounts.entries()).filter(([_, list]) => list.length > 1)
    console.log(`Episodes with identical audio_url: ${dupEpUrls.length}`)
    for (const [u, list] of dupEpUrls) {
      console.log(`  Audio URL: ${u} -> Used by ${list.length} episodes:`, list.map(x => `"${x.title}" (${x.id})`))
    }
    console.log(`Episodes with identical title: ${dupEpTitles.length}`)
    for (const [title, list] of dupEpTitles) {
      console.log(`  Episode: "${title}" -> ${list.length} records:`, list.map(x => `id: ${x.id}, audio: ${x.audio_url}`))
    }

    console.log('\n--- Sample Podcast Episodes ---')
    for (const ep of (episodes || []).slice(0, 10)) {
      console.log(`- "${ep.title}" | audio: ${ep.audio_url}`)
    }
  }

  // 4. Query import jobs
  const { data: jobs, error: jErr } = await supabase.from('audio_import_jobs').select('*').limit(20)
  if (jErr) {
    console.log('Import jobs error:', jErr.message)
  } else {
    console.log(`\nTotal import jobs inspected: ${jobs?.length || 0}`)
    for (const j of (jobs || [])) {
      console.log(`Job ${j.id}: ${j.source_url} -> status: ${j.status}, title: ${j.title || j.metadata?.title}`)
    }
  }
}

inspect().catch(console.error)

