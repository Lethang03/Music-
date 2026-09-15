import { test, expect } from '@playwright/test'
import { setup, tracks, userId, playerBar, playFirst } from './fixtures'
import {
  parseSyncedLyrics,
  parseLrc,
  toLrc,
  lyricTimestamp,
  activeLyricIndex,
  splitLyricsToLines,
  validateAndAlignTimestamps,
  calculateSyncQuality
} from '../src/lib/lyrics'
import { validateYouTubeUrl, BatchLyricsSyncRunner } from '../src/lib/geminiLyricsSync'

test('canonical lyric preservation: exact text, spelling, and order are preserved', () => {
  const canonicalLyrics = `First line with "quotes" and punctuation!
Second line: with special characters & accents (café, déjà vu).
Third line with irregular capitalization: ThIs Is CaNoNiCaL.`

  const canonicalLines = splitLyricsToLines(canonicalLyrics)
  expect(canonicalLines).toHaveLength(3)

  // Simulate Gemini returning altered text or paraphrased text
  const rawGeminiOutput = [
    { line_index: 0, text: 'Altered line without quotes', start: 2.5, end: 5.0, confidence: 0.95 },
    { line_index: 1, text: 'Second line simplified', start: 5.5, end: 8.0, confidence: 0.88 },
    { line_index: 2, text: 'third line lowercase', start: 8.5, end: 11.0, confidence: 0.92 }
  ]

  const aligned = validateAndAlignTimestamps(canonicalLyrics, rawGeminiOutput, { trackDuration: 15 })

  // Verify that the aligned text STRICTLY matches the canonical input
  expect(aligned).toHaveLength(3)
  expect(aligned[0].text).toBe('First line with "quotes" and punctuation!')
  expect(aligned[1].text).toBe('Second line: with special characters & accents (café, déjà vu).')
  expect(aligned[2].text).toBe('Third line with irregular capitalization: ThIs Is CaNoNiCaL.')
})

test('timestamp validation: monotonic, end > start, omitted ends inferred, final line fallback', () => {
  const canonical = 'Line 1\nLine 2\nLine 3\nLine 4'

  // Messy raw output:
  // - Line 0: missing end (omitted end)
  // - Line 1: end <= start (invalid end)
  // - Line 2: start < previous start (non-monotonic)
  // - Line 3: final line with missing end
  const messyTimestamps = [
    { line_index: 0, start: 2.0, end: null, confidence: 0.9 },
    { line_index: 1, start: 5.0, end: 4.0, confidence: 0.8 },
    { line_index: 2, start: 3.0, end: 9.0, confidence: 0.4 },
    { line_index: 3, start: 10.0, end: null, confidence: 0.9 }
  ]

  const aligned = validateAndAlignTimestamps(canonical, messyTimestamps, { trackDuration: 14 })

  expect(aligned).toHaveLength(4)

  // 1. Line 0 end inferred from Line 1 start
  expect(aligned[0].start).toBe(2.0)
  expect(aligned[0].end).toBe(5.0)

  // 2. Line 1 end fixed to be > start
  expect(aligned[1].start).toBe(5.0)
  expect(aligned[1].end).toBeGreaterThan(aligned[1].start)

  // 3. Line 2 adjusted to maintain monotonicity
  expect(aligned[2].start).toBeGreaterThanOrEqual(aligned[1].start)
  expect(aligned[2].isSuspicious).toBe(true)
  expect(aligned[2].confidenceLevel).toBe('low')

  // 4. Line 3 final line uses track duration (14)
  expect(aligned[3].start).toBe(10.0)
  expect(aligned[3].end).toBe(14.0)

  // 5. Monotonic property across all lines
  for (let i = 1; i < aligned.length; i++) {
    expect(aligned[i].start).toBeGreaterThanOrEqual(aligned[i - 1].start)
    expect(aligned[i].end).toBeGreaterThan(aligned[i].start)
  }
})

test('quality calculation: detects duration mismatch, low confidence, and unmatched lines', () => {
  const canonical = 'Line 1\nLine 2\nLine 3'
  const aligned = [
    { line_index: 0, text: 'Line 1', start: 1.0, end: 4.0, confidence: 0.95, confidenceLevel: 'high' },
    { line_index: 1, text: 'Line 2', start: 4.5, end: 7.0, confidence: 0.45, confidenceLevel: 'low' },
    { line_index: 2, text: 'Line 3', start: 7.5, end: 10.0, confidence: 0.70, confidenceLevel: 'medium' }
  ]

  // Normal matching duration
  const qualityGood = calculateSyncQuality(canonical, aligned, { trackDuration: 12, sourceDuration: 12.5 })
  expect(qualityGood.originalLines).toBe(3)
  expect(qualityGood.alignedLines).toBe(3)
  expect(qualityGood.unmatchedLines).toBe(0)
  expect(qualityGood.lowConfidenceLines).toBe(1)
  expect(qualityGood.durationMismatch).toBe(false)
  expect(qualityGood.status).toBe('needs_review') // flagged because of 1 low confidence line

  // Significant duration mismatch (> 5 seconds difference)
  const qualityMismatch = calculateSyncQuality(canonical, aligned, { trackDuration: 12, sourceDuration: 30 })
  expect(qualityMismatch.durationMismatch).toBe(true)
  expect(qualityMismatch.durationDifference).toBe(18)
  expect(qualityMismatch.status).toBe('needs_review')

  // Empty alignment -> failed
  const qualityFailed = calculateSyncQuality(canonical, [], { trackDuration: 12, sourceDuration: 12 })
  expect(qualityFailed.status).toBe('failed')
  expect(qualityFailed.unmatchedLines).toBe(3)
})

test('YouTube URL validation: accepts valid formats and rejects non-YouTube URLs', () => {
  const validUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'
  ]

  for (const url of validUrls) {
    const validated = validateYouTubeUrl(url)
    expect(validated.source_platform).toBe('youtube')
    expect(validated.source_id).toBe('dQw4w9WgXcQ')
    expect(validated.source_url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  }

  expect(() => validateYouTubeUrl('https://example.com/audio.mp3')).toThrow(/Only YouTube/i)
  expect(() => validateYouTubeUrl('not-a-url')).toThrow(/valid YouTube/i)
})

test('BatchLyricsSyncRunner: manages queue, concurrency, skipping, pause and resume', async () => {
  const mockTracks = [
    { id: 'track-1', title: 'Song 1', lyrics: 'First plain lyric line\nSecond line', lyrics_type: 'plain', source_url: 'https://youtu.be/11111111111' },
    { id: 'track-2', title: 'Song 2', lyrics: 'Another song line\nAnother line', lyrics_type: 'synced', synced_lyrics: [{ start: 1, end: 4, text: 'ok' }], source_url: 'https://youtu.be/22222222222' },
    { id: 'track-3', title: 'Song 3', lyrics: '', lyrics_type: 'plain', source_url: 'https://youtu.be/33333333333' },
    { id: 'track-4', title: 'Song 4', lyrics: 'Fourth song line', lyrics_type: 'plain', source_url: 'https://youtu.be/44444444444' }
  ]

  // Runner without forceResync should filter out track-2 (already synced) and track-3 (no lyrics)
  const runner = new BatchLyricsSyncRunner({
    tracks: mockTracks,
    options: { concurrency: 1, forceResync: false }
  })
  runner.init()

  expect(runner.getEligibleCount()).toBe(2) // track-1 and track-4
  const stats = runner.getStats()
  expect(stats.total).toBe(2)
  expect(stats.queued).toBe(2)

  // With forceResync, track-2 is included
  const forceRunner = new BatchLyricsSyncRunner({
    tracks: mockTracks,
    options: { concurrency: 2, forceResync: true }
  })
  forceRunner.init()
  expect(forceRunner.getEligibleCount()).toBe(3) // track-1, track-2, track-4
})

test('Admin UI: Auto Sync with YouTube workflow: detects source, aligns, previews confidence and saves', async ({ page }) => {
  const { db } = await setup(page, { admin: true })
  db.music_tracks[0].lyrics = 'Verse 1 line one\nVerse 1 line two\nChorus line'
  db.music_tracks[0].lyrics_type = 'plain'
  db.music_tracks[0].source_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

  await page.goto('/admin')
  await page.locator('tr').filter({ hasText: 'Track 1' }).getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced Details' }).click()

  // Verify YouTube Source URL is detected
  await expect(page.getByLabel('YouTube Source URL')).toHaveValue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await expect(page.locator('.v2-source-detected-badge')).toBeVisible()

  // Click Auto Sync with YouTube
  await page.getByRole('button', { name: 'Auto Sync with YouTube', exact: true }).click()

  // Alignment completes to Step 4 Preview
  await expect(page.locator('.v2-sync-badge-step')).toHaveText('Step 4: Preview')
  await expect(page.locator('.v2-sync-preview-header')).toContainText('Alignment Complete')

  // Verify line-by-line preview displays confidence tags
  const lineRows = page.locator('.v2-sync-line-row')
  await expect(lineRows).toHaveCount(3)
  await expect(lineRows.first()).toContainText('Verse 1 line one')
  await expect(lineRows.first().locator('.v2-sync-line-conf')).toContainText('High')

  // Interactive seek: clicking a line seeks the preview audio
  await lineRows.nth(1).click()
  // Line should become active
  await expect(lineRows.nth(1)).toHaveClass(/active/)

  // Click "Save Synced Lyrics"
  await page.getByRole('button', { name: 'Save Synced Lyrics', exact: true }).click()

  // Verify notice shows success and lyrics_type became synced
  await expect(page.getByLabel('lyrics type')).toHaveValue('synced')
  await expect(page.locator('small[role="status"]')).toContainText('Original plain lyrics preserved intact')

  // Save the track
  await page.getByRole('button', { name: 'Save content', exact: true }).click()

  // Database verification: canonical plain lyrics PRESERVED, lyrics_type is synced, synced_lyrics saved!
  await expect.poll(() => db.music_tracks[0].lyrics_type).toBe('synced')
  expect(db.music_tracks[0].lyrics).toBe('Verse 1 line one\nVerse 1 line two\nChorus line')
  expect(db.music_tracks[0].synced_lyrics).toHaveLength(3)
  expect(db.music_tracks[0].synced_lyrics[0].text).toBe('Verse 1 line one')
})

test('Admin UI: batch modal opens, shows eligible count, controls, and runs', async ({ page }) => {
  const { db } = await setup(page, { admin: true })
  db.music_tracks[0].lyrics = 'Song 1 lyrics'
  db.music_tracks[0].lyrics_type = 'plain'
  db.music_tracks[0].source_url = 'https://youtu.be/dQw4w9WgXcQ'

  db.music_tracks[1].lyrics = 'Song 2 lyrics'
  db.music_tracks[1].lyrics_type = 'plain'
  db.music_tracks[1].source_url = 'https://youtu.be/dQw4w9WgXcQ'

  await page.goto('/admin')

  // Click Batch Sync button
  await page.getByRole('button', { name: 'Auto sync existing lyrics' }).click()

  // Batch modal opens
  await expect(page.getByRole('heading', { name: 'Auto Sync Existing Lyrics' })).toBeVisible()
  await expect(page.locator('.v2-batch-eligibility')).toContainText('2 tracks eligible')

  // Start batch sync
  await page.getByRole('button', { name: 'Start Batch Sync' }).click()

  // Status transitions
  await expect(page.locator('.v2-batch-status-badge')).toContainText(/(RUNNING|COMPLETED)/)

  // Wait for processing
  await expect.poll(() => page.locator('.v2-status-pill.completed').count(), { timeout: 10000 }).toBe(2)
  await expect(page.locator('.v2-batch-status-badge')).toHaveText('COMPLETED')

  // Close modal
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Auto Sync Existing Lyrics' })).toHaveCount(0)
})

test('Player integration: synchronized song highlights active lyric and supports seek', async ({ page }) => {
  const { db } = await setup(page, { seconds: 12 })
  db.music_tracks[0].lyrics = 'First synced line\nSecond synced line\nThird synced line'
  db.music_tracks[0].lyrics_type = 'synced'
  db.music_tracks[0].synced_lyrics = [
    { start: 0, end: 4, text: 'First synced line' },
    { start: 4, end: 8, text: 'Second synced line' },
    { start: 8, end: 12, text: 'Third synced line' }
  ]

  await playFirst(page)
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click()

  // Verify SyncedLyrics renders
  await expect(page.locator('.v2-synced-lyrics')).toBeVisible()
  await expect(page.locator('.v2-synced-lyric').first()).toContainText('First synced line')

  // Active line highlights
  await expect(page.locator('.v2-synced-lyric.active')).toBeVisible()

  // Clicking second line seeks audio
  await page.locator('.v2-synced-lyric').nth(1).click()
  await expect.poll(() => page.evaluate(() => window.testAudio.find(a => a.src)?.currentTime || 0)).toBeGreaterThanOrEqual(3.5)
})

