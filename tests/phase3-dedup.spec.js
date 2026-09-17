import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Test URL Normalization & Source Hash algorithms
function normalizeSourceUrl(rawUrl, type) {
  const trimmed = String(rawUrl || '').trim()
  if (type === 'upload') return trimmed
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase()
  }

  const hostname = parsed.hostname.toLowerCase()
  const isYouTube = hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtu.be'

  if (isYouTube) {
    let videoId = null
    if (hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1).split('/')[0] || null
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.split('/')[2] || null
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/')[2] || null
    } else if (parsed.searchParams.has('v')) {
      videoId = parsed.searchParams.get('v')
    }

    if (videoId && /^[\w-]{11}$/.test(videoId)) {
      return `https://www.youtube.com/watch?v=${videoId}`
    }
  }

  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid', 'si']
  trackingParams.forEach(param => parsed.searchParams.delete(param))
  parsed.searchParams.sort()

  let pathname = parsed.pathname
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }
  parsed.pathname = pathname

  return parsed.toString()
}

function computeSourceHash(canonicalUrl) {
  return createHash('sha256').update(canonicalUrl).digest('hex')
}

test.describe('SoundVerse Phase 3 - Audio Deduplication System', () => {
  test('normalizes various YouTube URL formats to canonical URL', () => {
    const videoId = 'dQw4w9WgXcQ'
    const variations = [
      `https://www.youtube.com/watch?v=${videoId}`,
      `https://youtube.com/watch?v=${videoId}&feature=share`,
      `https://youtu.be/${videoId}`,
      `https://youtu.be/${videoId}?si=trackingParam123`,
      `https://m.youtube.com/watch?v=${videoId}&utm_source=twitter`,
      `https://www.youtube.com/shorts/${videoId}`,
      `https://www.youtube.com/embed/${videoId}`
    ]

    const normalizedResults = variations.map(url => normalizeSourceUrl(url, 'video'))
    const expected = `https://www.youtube.com/watch?v=${videoId}`

    normalizedResults.forEach(res => {
      expect(res).toBe(expected)
    })

    // All variations must produce the exact same source_hash
    const hashes = variations.map(url => computeSourceHash(normalizeSourceUrl(url, 'video')))
    const uniqueHashes = new Set(hashes)
    expect(uniqueHashes.size).toBe(1)
  })

  test('normalizes generic external URLs by removing tracking parameters and sorting queries', () => {
    const urlA = 'https://example.com/audio.mp3?b=2&a=1&utm_source=newsletter&si=abc'
    const urlB = 'https://example.com/audio.mp3?a=1&b=2&ref=partner'

    const normA = normalizeSourceUrl(urlA, 'url')
    const normB = normalizeSourceUrl(urlB, 'url')

    expect(normA).toBe('https://example.com/audio.mp3?a=1&b=2')
    expect(normB).toBe('https://example.com/audio.mp3?a=1&b=2')
    expect(computeSourceHash(normA)).toBe(computeSourceHash(normB))
  })

  test('audio content hashing generates deterministic SHA-256', () => {
    const buffer1 = Buffer.from('SoundVerse Test Audio Stream Data Chunk 1')
    const buffer2 = Buffer.from('SoundVerse Test Audio Stream Data Chunk 1')
    const bufferDifferent = Buffer.from('SoundVerse Different Audio Stream Data')

    const hash1 = createHash('sha256').update(buffer1).digest('hex')
    const hash2 = createHash('sha256').update(buffer2).digest('hex')
    const hashDiff = createHash('sha256').update(bufferDifferent).digest('hex')

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hashDiff)
    expect(hash1).toHaveLength(64)
  })

  test('PHASE3_DATABASE_MIGRATION.sql defines all required columns and indices', () => {
    const sqlPath = path.resolve('PHASE3_DATABASE_MIGRATION.sql')
    expect(fs.existsSync(sqlPath)).toBe(true)

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8')
    expect(sqlContent).toContain('music_tracks')
    expect(sqlContent).toContain('audio_hash')
    expect(sqlContent).toContain('file_size')
    expect(sqlContent).toContain('audio_mime_type')
    expect(sqlContent).toContain('idx_music_tracks_audio_hash')

    expect(sqlContent).toContain('episodes')
    expect(sqlContent).toContain('idx_episodes_audio_hash')

    expect(sqlContent).toContain('import_jobs')
    expect(sqlContent).toContain('source_hash')
    expect(sqlContent).toContain('idx_import_jobs_source_hash')
  })

  test('simulated audio worker deduplication reuses existing audio URL and skips upload', async () => {
    const fakeDatabase = {
      music_tracks: [
        { id: 'track-1', title: 'Existing Track', audio_url: 'https://soundverse.supabase.co/audio/track-1.mp3', audio_hash: 'abc123hash' }
      ],
      episodes: [
        { id: 'ep-1', title: 'Existing Episode', audio_url: 'https://soundverse.supabase.co/audio/ep-1.mp3', audio_hash: 'def456hash' }
      ]
    }

    let uploadCalls = 0
    function fakeUpload(outputFile) {
      uploadCalls++
      return 'https://soundverse.supabase.co/audio/new-upload.mp3'
    }

    function processConvertedAudio(audioHash, isPodcast) {
      // Step 1: Check music_tracks
      const matchedTrack = fakeDatabase.music_tracks.find(t => t.audio_hash === audioHash)
      if (matchedTrack) {
        return { audioUrl: matchedTrack.audio_url, deduplicated: true }
      }

      // Step 2: Check episodes
      const matchedEpisode = fakeDatabase.episodes.find(e => e.audio_hash === audioHash)
      if (matchedEpisode) {
        return { audioUrl: matchedEpisode.audio_url, deduplicated: true }
      }

      // Step 3: No match -> Upload
      const url = fakeUpload('output.mp3')
      return { audioUrl: url, deduplicated: false }
    }

    // Case A: Duplicate track hash
    const resA = processConvertedAudio('abc123hash', false)
    expect(resA.deduplicated).toBe(true)
    expect(resA.audioUrl).toBe('https://soundverse.supabase.co/audio/track-1.mp3')
    expect(uploadCalls).toBe(0)

    // Case B: Duplicate episode hash
    const resB = processConvertedAudio('def456hash', true)
    expect(resB.deduplicated).toBe(true)
    expect(resB.audioUrl).toBe('https://soundverse.supabase.co/audio/ep-1.mp3')
    expect(uploadCalls).toBe(0)

    // Case C: Brand new unique audio
    const resC = processConvertedAudio('brand-new-hash-789', false)
    expect(resC.deduplicated).toBe(false)
    expect(resC.audioUrl).toBe('https://soundverse.supabase.co/audio/new-upload.mp3')
    expect(uploadCalls).toBe(1)
  })
})

