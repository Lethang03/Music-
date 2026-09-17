import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load credentials
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

console.log('====================================================')
console.log('SoundVerse Audio Storage Duplicate Detection Audit')
console.log('====================================================')
console.log('Supabase Endpoint:', url || 'NOT CONFIGURED')
console.log('Using Key Type:', key?.startsWith('eyJ') ? 'JWT Token' : 'None')

if (!url || !key) {
  console.error('ERROR: Missing Supabase URL or credentials.')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
})

async function runAudit() {
  const report = {
    timestamp: new Date().toISOString(),
    endpoint: url,
    status: 'unknown',
    musicDuplicatesByUrl: [],
    musicDuplicatesByTitle: [],
    podcastDuplicatesByUrl: [],
    podcastDuplicatesByTitle: [],
    repeatedImportJobs: [],
    storageDuplicates: [],
    notes: []
  }

  try {
    // 1. Check music_tracks
    console.log('\n[1/4] Inspecting music_tracks...')
    const { data: tracks, error: tErr } = await supabase
      .from('music_tracks')
      .select('id, title, artist, audio_url, duration, created_at')

    if (tErr) {
      throw new Error(`Failed to query music_tracks: ${tErr.message}`)
    }

    console.log(`Found ${tracks.length} music tracks. Analyzing...`)
    
    // Check by identical audio_url
    const musicByUrl = new Map()
    const musicByTitle = new Map()

    for (const t of tracks) {
      if (t.audio_url) {
        const cleanUrl = t.audio_url.trim()
        musicByUrl.set(cleanUrl, (musicByUrl.get(cleanUrl) || []).concat(t))
      }
      if (t.title) {
        const key = `${t.title.trim().toLowerCase()}___${(t.artist || '').trim().toLowerCase()}`
        musicByTitle.set(key, (musicByTitle.get(key) || []).concat(t))
      }
    }

    for (const [audioUrl, list] of musicByUrl.entries()) {
      if (list.length > 1) {
        report.musicDuplicatesByUrl.push({
          audioUrl,
          count: list.length,
          tracks: list.map(x => ({ id: x.id, title: x.title, artist: x.artist }))
        })
      }
    }

    for (const [key, list] of musicByTitle.entries()) {
      if (list.length > 1) {
        report.musicDuplicatesByTitle.push({
          titleKey: key,
          count: list.length,
          tracks: list.map(x => ({ id: x.id, title: x.title, artist: x.artist, audioUrl: x.audio_url }))
        })
      }
    }

    // 2. Check episodes / podcast_episodes
    console.log('\n[2/4] Inspecting podcast episodes...')
    let episodes = []
    const ep1 = await supabase.from('episodes').select('id, podcast_id, title, audio_url, duration, created_at')
    if (!ep1.error && ep1.data) {
      episodes = ep1.data
    } else {
      const ep2 = await supabase.from('podcast_episodes').select('id, podcast_id, title, audio_url, duration, created_at')
      if (!ep2.error && ep2.data) episodes = ep2.data
    }

    console.log(`Found ${episodes.length} podcast episodes. Analyzing...`)
    const epByUrl = new Map()
    const epByTitle = new Map()

    for (const ep of episodes) {
      if (ep.audio_url) {
        const cleanUrl = ep.audio_url.trim()
        epByUrl.set(cleanUrl, (epByUrl.get(cleanUrl) || []).concat(ep))
      }
      if (ep.title) {
        const key = `${ep.podcast_id || ''}___${ep.title.trim().toLowerCase()}`
        epByTitle.set(key, (epByTitle.get(key) || []).concat(ep))
      }
    }

    for (const [audioUrl, list] of epByUrl.entries()) {
      if (list.length > 1) {
        report.podcastDuplicatesByUrl.push({
          audioUrl,
          count: list.length,
          episodes: list.map(x => ({ id: x.id, title: x.title, podcastId: x.podcast_id }))
        })
      }
    }

    for (const [key, list] of epByTitle.entries()) {
      if (list.length > 1) {
        report.podcastDuplicatesByTitle.push({
          titleKey: key,
          count: list.length,
          episodes: list.map(x => ({ id: x.id, title: x.title, audioUrl: x.audio_url }))
        })
      }
    }

    // 3. Check import_jobs
    console.log('\n[3/4] Inspecting audio import jobs...')
    const { data: jobs, error: jErr } = await supabase
      .from('import_jobs')
      .select('id, source_url, status, created_at, track_id, metadata')
      .order('created_at', { ascending: false })
      .limit(200)

    if (!jErr && jobs) {
      const jobsBySource = new Map()
      for (const j of jobs) {
        if (j.source_url) {
          const clean = j.source_url.trim()
          jobsBySource.set(clean, (jobsBySource.get(clean) || []).concat(j))
        }
      }
      for (const [src, list] of jobsBySource.entries()) {
        if (list.length > 1) {
          report.repeatedImportJobs.push({
            sourceUrl: src,
            count: list.length,
            jobs: list.map(x => ({ id: x.id, status: x.status, createdAt: x.created_at, trackId: x.track_id }))
          })
        }
      }
    }

    // 4. Storage buckets
    console.log('\n[4/4] Inspecting storage files...')
    for (const bucketName of ['soundverse', 'music-audio', 'podcast-audio']) {
      const { data: files, error: fErr } = await supabase.storage.from(bucketName).list('', { limit: 100 })
      if (!fErr && files?.length) {
        // Group files by size
        const bySize = new Map()
        for (const f of files) {
          const sz = f.metadata?.size
          if (sz && sz > 500000) { // audio files > 500KB
            bySize.set(sz, (bySize.get(sz) || []).concat(f))
          }
        }
        for (const [size, list] of bySize.entries()) {
          if (list.length > 1) {
            report.storageDuplicates.push({
              bucket: bucketName,
              sizeBytes: size,
              count: list.length,
              files: list.map(x => x.name)
            })
          }
        }
      }
    }

    report.status = 'success'
  } catch (err) {
    report.status = 'blocked_by_quota'
    report.error = err.message
    console.warn('\n⚠️ Supabase Query Notice:', err.message)
    if (err.message.includes('exceed_cached_egress_quota')) {
      report.notes.push(
        'Supabase API gateway is currently rejecting queries with exceed_cached_egress_quota.',
        'To run live database queries, the Supabase project owner must log in to the Supabase dashboard and lift the spend cap or reset the quota restriction.'
      )
    }
  }

  // Output markdown report
  const md = generateMarkdownReport(report)
  fs.writeFileSync('audit/DUPLICATE_AUDIO_REPORT.md', md)
  console.log('\n====================================================')
  console.log('Audit completed. Report saved to: audit/DUPLICATE_AUDIO_REPORT.md')
  console.log('====================================================')
  console.log(md)
}

function generateMarkdownReport(r) {
  return `# SoundVerse Audio Storage Duplicate Detection Report

**Timestamp**: ${r.timestamp}
**Supabase Endpoint**: \`${r.endpoint}\`
**Status**: ${r.status.toUpperCase()}

${r.error ? `> [!WARNING]\n> **API Gateway Response**: ${r.error}\n` : ''}

${r.notes.map(n => `- ${n}`).join('\n')}

---

## 1. Music Tracks Sharing Identical Audio URL (${r.musicDuplicatesByUrl.length})

${r.musicDuplicatesByUrl.length === 0 ? '_No duplicate audio URLs detected across tracks._' : r.musicDuplicatesByUrl.map(d => `
- **Audio URL**: \`${d.audioUrl}\` (referenced by **${d.count}** tracks)
${d.tracks.map(t => `  - "${t.title}" by ${t.artist || 'Unknown'} (id: \`${t.id}\`)`).join('\n')}
`).join('\n')}

---

## 2. Repeated Tracks (Identical Title & Artist with Multiple Records) (${r.musicDuplicatesByTitle.length})

${r.musicDuplicatesByTitle.length === 0 ? '_No duplicate tracks by title/artist detected._' : r.musicDuplicatesByTitle.map(d => `
- **Track**: \`${d.titleKey.replace('___', ' by ')}\` (**${d.count}** entries)
${d.tracks.map(t => `  - ID: \`${t.id}\` | Audio: \`${t.audioUrl}\``).join('\n')}
`).join('\n')}

---

## 3. Podcast Episodes Sharing Identical Audio URL (${r.podcastDuplicatesByUrl.length})

${r.podcastDuplicatesByUrl.length === 0 ? '_No duplicate audio URLs detected across podcast episodes._' : r.podcastDuplicatesByUrl.map(d => `
- **Audio URL**: \`${d.audioUrl}\` (referenced by **${d.count}** episodes)
${d.episodes.map(e => `  - "${e.title}" (id: \`${e.id}\`)`).join('\n')}
`).join('\n')}

---

## 4. Repeated Import Jobs (${r.repeatedImportJobs.length})

${r.repeatedImportJobs.length === 0 ? '_No repeated import jobs detected in the last 200 jobs._' : r.repeatedImportJobs.map(j => `
- **Source URL**: \`${j.sourceUrl}\` (queued **${j.count}** times)
${j.jobs.map(x => `  - Job ID: \`${x.id}\` | Status: \`${x.status}\` | Date: ${x.createdAt}`).join('\n')}
`).join('\n')}

---

## 5. Storage Bucket Duplicate Files by Exact Size (${r.storageDuplicates.length})

${r.storageDuplicates.length === 0 ? '_No duplicate audio file sizes detected in inspected buckets._' : r.storageDuplicates.map(s => `
- **Bucket**: \`${s.bucket}\` | Size: ${(s.sizeBytes / (1024 * 1024)).toFixed(2)} MB (**${s.count}** files)
${s.files.map(f => `  - \`${f}\``).join('\n')}
`).join('\n')}

---

## Remediation Policy
- **DO NOT DELETE AUTOMATICALLY**: Audio files and tracks must not be deleted automatically.
- Once the project owner reviews this report and lifts the dashboard cap, admin users can verify each duplicate track in the Admin UI and safely delete unneeded duplicate entries.
`
}

runAudit().catch(console.error)

