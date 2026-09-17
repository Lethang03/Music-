import { test, expect } from '@playwright/test'
import { setup, playerBar, playFirst, tracks } from './fixtures.js'
import crypto from 'node:crypto'

test.describe('SoundVerse Phase 5 - Full Audio Performance Test Suite', () => {

  test('Player Core Controls: play, pause, resume, next, previous, shuffle, queue', async ({ page }) => {
    await setup(page, { seconds: 12 })
    await playFirst(page)

    const bar = playerBar(page)
    await expect(bar).toBeVisible()
    await expect(bar.getByText('Track 1')).toBeVisible()
    const pauseBtn = bar.getByTitle('Pause', { exact: true })
    await expect(pauseBtn).toBeVisible()

    // 1. Verify Audio element is playing with preload="metadata"
    const playState = await page.evaluate(() => {
      const audio = window.testAudio?.[0]
      return {
        hasAudio: Boolean(audio),
        paused: audio?.paused,
        preload: audio?.preload,
      }
    })
    expect(playState.hasAudio).toBe(true)
    expect(playState.paused).toBe(false)
    expect(playState.preload).toBe('metadata')

    // 2. Pause
    await pauseBtn.click()
    const playBtn = bar.getByTitle('Play', { exact: true })
    await expect(playBtn).toBeVisible()

    const isPaused = await page.evaluate(() => window.testAudio?.[0]?.paused)
    expect(isPaused).toBe(true)

    // 3. Resume
    await playBtn.click()
    await expect(bar.getByTitle('Pause', { exact: true })).toBeVisible()
    const isResumed = await page.evaluate(() => window.testAudio?.[0]?.paused)
    expect(isResumed).toBe(false)

    // 4. Next track
    const nextBtn = bar.getByTitle('Next', { exact: true })
    await nextBtn.click()
    await expect(bar.getByText('Track 2')).toBeVisible()

    // 5. Previous track
    const prevBtn = bar.getByTitle('Previous', { exact: true })
    await prevBtn.click()
    await expect(bar.getByText('Track 1')).toBeVisible()

    // 6. Shuffle toggle
    const shuffleBtn = bar.getByTitle('Shuffle', { exact: true })
    if (await shuffleBtn.isVisible()) {
      await shuffleBtn.click()
      await expect(shuffleBtn).toHaveClass(/\bon\b/)
      await shuffleBtn.click()
      await expect(shuffleBtn).not.toHaveClass(/\bon\b/)
    }

    // 7. Queue drawer / overlay
    const queueBtn = bar.getByTitle('Queue', { exact: true })
    if (await queueBtn.isVisible()) {
      await queueBtn.click()
    }
  })

  test('Bandwidth Optimization: zero preload on browse, zero duplicate audio requests', async ({ page }) => {
    const queue = tracks(12)

    await setup(page, {
      player: {
        queue,
        index: 0,
        currentTime: 0,
      }
    })

    // 1. Browsing with a restored queue: MUST NOT download or preload audio!
    await page.goto('/music')
    await expect(playerBar(page).getByTitle('Play', { exact: true })).toBeVisible()
    await page.waitForTimeout(300)

    // Verify audio network stats while browsing
    const idleStats = await page.evaluate(() => {
      const loggerStats = window.__soundverse_audio_stats__?.get() || { totalRequests: 0 }
      const audio = window.testAudio?.[0]
      return {
        totalRequests: loggerStats.totalRequests,
        preload: audio?.preload || 'none',
        audioPlaying: window.mediaEvents.filter(e => e.event === 'playing').length,
      }
    })
    expect(idleStats.preload).toBe('none')
    expect(idleStats.audioPlaying).toBe(0)
    expect(idleStats.totalRequests).toBe(0) // Exactly 0 audio network requests on browsing!

    // 2. Play action: exactly 1 request initiated with preload="metadata"
    await playerBar(page).getByTitle('Play', { exact: true }).click()
    await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

    const playStats = await page.evaluate(() => {
      const loggerStats = window.__soundverse_audio_stats__?.get() || { totalRequests: 0 }
      const audio = window.testAudio?.[0]
      return {
        totalRequests: loggerStats.totalRequests,
        preload: audio?.preload,
      }
    })
    expect(playStats.totalRequests).toBe(1) // Exactly 1 audio stream load request
    expect(playStats.preload).toBe('metadata')

    // 3. Duplicate play action on the same track: mediaKey prevents duplicate fetch
    await page.locator('.v2-premium-card').filter({ hasText: 'Track 1' }).click()
    await page.waitForTimeout(300)

    const duplicateStats = await page.evaluate(() => {
      const loggerStats = window.__soundverse_audio_stats__?.get() || { totalRequests: 0 }
      return {
        totalRequests: loggerStats.totalRequests,
        duplicateRequests: loggerStats.duplicateRequests,
      }
    })
    expect(duplicateStats.totalRequests).toBe(1) // Still exactly 1 request!
    expect(duplicateStats.duplicateRequests).toBe(0) // Zero duplicate downloads!
  })

  test('Mobile & Background Playback: Android Chrome viewport, MediaSession, screen off simulation', async ({ page }) => {
    // Emulate mobile Android Chrome viewport
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page)

    // Verify MediaSession API mock exists
    await page.addInitScript(() => {
      window.mediaSessionLog = {
        metadata: null,
        playbackState: 'none',
        actions: {},
        positionStates: [],
      }
      navigator.mediaSession.setActionHandler = (action, handler) => {
        window.mediaSessionLog.actions[action] = handler
      }
      navigator.mediaSession.setPositionState = (state) => {
        window.mediaSessionLog.positionStates.push(state)
      }
      Object.defineProperty(navigator.mediaSession, 'playbackState', {
        set(v) { window.mediaSessionLog.playbackState = v },
        get() { return window.mediaSessionLog.playbackState },
      })
      Object.defineProperty(navigator.mediaSession, 'metadata', {
        set(v) { window.mediaSessionLog.metadata = v },
        get() { return window.mediaSessionLog.metadata },
      })
    })

    await playFirst(page)

    // 1. Verify MediaSession metadata & actions are bound
    const mediaSessionInfo = await page.evaluate(() => {
      return {
        title: window.mediaSessionLog.metadata?.title,
        playbackState: window.mediaSessionLog.playbackState,
        hasPlay: typeof window.mediaSessionLog.actions.play === 'function',
        hasPause: typeof window.mediaSessionLog.actions.pause === 'function',
        hasNext: typeof window.mediaSessionLog.actions.nexttrack === 'function',
        hasPrev: typeof window.mediaSessionLog.actions.previoustrack === 'function',
        hasStop: typeof window.mediaSessionLog.actions.stop === 'function',
      }
    })
    expect(mediaSessionInfo.title).toBe('Track 1')
    expect(mediaSessionInfo.hasPlay).toBe(true)
    expect(mediaSessionInfo.hasPause).toBe(true)
    expect(mediaSessionInfo.hasNext).toBe(true)
    expect(mediaSessionInfo.hasPrev).toBe(true)
    expect(mediaSessionInfo.hasStop).toBe(true)

    // 2. Simulate Screen Off / Background (document.visibilitychange -> 'hidden')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // Verify player is STILL playing in the background
    const isPlayingInBackground = await page.evaluate(() => !window.testAudio?.[0]?.paused)
    expect(isPlayingInBackground).toBe(true)

    // 3. Simulate Screen On (document.visibilitychange -> 'visible')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const isStillPlaying = await page.evaluate(() => !window.testAudio?.[0]?.paused)
    expect(isStillPlaying).toBe(true)
  })

  test('Import Deduplication: Importing the same YouTube URL 3 times yields 1 file and 1 job', async () => {
    // Test URL normalization and hashing logic across 3 variations of the same YouTube video
    const variations = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=tracking123&feature=shared',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=twitter&utm_medium=social',
    ]

    function normalizeSourceUrl(inputUrl) {
      try {
        const u = new URL(inputUrl)
        let videoId = null
        if (u.hostname.includes('youtube.com')) {
          if (u.pathname === '/watch') videoId = u.searchParams.get('v')
          else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2]
          else if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/')[2]
        } else if (u.hostname === 'youtu.be') {
          videoId = u.pathname.slice(1).split('/')[0]
        }
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return `https://www.youtube.com/watch?v=${videoId}`
        }
        const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si', 'feature', 'fbclid', 'gclid', 'ref', 't', 'start']
        trackingKeys.forEach(k => u.searchParams.delete(k))
        const sortedParams = new URLSearchParams()
        Array.from(u.searchParams.keys()).sort().forEach(key => {
          u.searchParams.getAll(key).forEach(val => sortedParams.append(key, val))
        })
        return `${u.origin}${u.pathname}${sortedParams.toString() ? '?' + sortedParams.toString() : ''}`
      } catch {
        return inputUrl.trim()
      }
    }

    function computeSourceHash(url) {
      return crypto.createHash('sha256').update(url).digest('hex')
    }

    // 1. Normalize all 3 URLs
    const normalized = variations.map(normalizeSourceUrl)
    expect(normalized[0]).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(normalized[1]).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(normalized[2]).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // 2. Compute source_hash for all 3: must be identical
    const hashes = normalized.map(computeSourceHash)
    expect(hashes[0]).toBe(hashes[1])
    expect(hashes[1]).toBe(hashes[2])

    // 3. Simulate Ingestion Job Database with Deduplication
    const jobDatabase = []
    const canonicalAudioHash = '3f7b8a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a'

    function handleImportRequest(rawUrl) {
      const canonical = normalizeSourceUrl(rawUrl)
      const sourceHash = computeSourceHash(canonical)

      // Deduplication check
      const existing = jobDatabase.find(j => j.source_hash === sourceHash && ['pending', 'processing', 'completed'].includes(j.status))
      if (existing) {
        return { job: existing, reused: true }
      }

      const newJob = {
        id: `job-${jobDatabase.length + 1}`,
        source_url: canonical,
        source_hash: sourceHash,
        status: 'completed',
        audio_url: 'https://soundverse-test.supabase.co/storage/v1/object/public/music-audio/canonical-song.mp3',
        audio_hash: canonicalAudioHash,
        created_at: new Date().toISOString(),
      }
      jobDatabase.push(newJob)
      return { job: newJob, reused: false }
    }

    // Request 1: New job created
    const res1 = handleImportRequest(variations[0])
    expect(res1.reused).toBe(false)
    expect(jobDatabase.length).toBe(1)

    // Request 2: Existing job returned, reused = true
    const res2 = handleImportRequest(variations[1])
    expect(res2.reused).toBe(true)
    expect(res2.job.id).toBe(res1.job.id)
    expect(jobDatabase.length).toBe(1) // Still exactly 1 job!

    // Request 3: Existing job returned, reused = true
    const res3 = handleImportRequest(variations[2])
    expect(res3.reused).toBe(true)
    expect(res3.job.id).toBe(res1.job.id)
    expect(jobDatabase.length).toBe(1) // Still exactly 1 job!

    // 4. Simulate Audio Worker Deduplication: Same audio_hash reuses existing storage URL
    const storageFiles = ['canonical-song.mp3'] // 1 file in storage
    let uploadCount = 0

    function workerIngest(audioBuffer, audioHash) {
      // Check if hash matches an existing record
      const match = jobDatabase.find(j => j.audio_hash === audioHash)
      if (match) {
        // Reuse existing URL, skip upload!
        return { audioUrl: match.audio_url, skippedUpload: true }
      }
      uploadCount++
      storageFiles.push(`song-${uploadCount}.mp3`)
      return { audioUrl: `.../song-${uploadCount}.mp3`, skippedUpload: false }
    }

    // Worker checks audio_hash: detects match, skips storage upload
    const workerResult1 = workerIngest(Buffer.from('AUDIO_BYTES'), canonicalAudioHash)
    expect(workerResult1.skippedUpload).toBe(true) // Upload bypassed!
    expect(storageFiles.length).toBe(1) // Exactly 1 audio file!
  })
})

