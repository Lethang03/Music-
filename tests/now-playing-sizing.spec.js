import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/home-podcast-final/legacy'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

async function preparePlayer(page, viewport) {
  await page.setViewportSize(viewport)
  const data = await setup(page, { admin: true, seconds: 180 })
  data.db.music_tracks = [
    {
      id: 'track-np-1',
      title: 'Echoes of the Starlight Universe and Infinite Night Skies',
      artist: 'Starlight Echoes & The Cosmic Synthesizers Collective',
      album: 'Cosmic Journey',
      duration: 215,
      audio_url: 'http://127.0.0.1:3100/test-audio/1.wav?seconds=215',
      cover_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><rect width="500" height="500" fill="url(#g)"/><circle cx="250" cy="250" r="160" fill="#0f172a"/><circle cx="250" cy="250" r="40" fill="#38bdf8"/></svg>'),
      published: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'track-np-2',
      title: 'Neon Odyssey Horizon',
      artist: 'Solar Pulse',
      album: 'Cosmic Journey',
      duration: 180,
      audio_url: 'http://127.0.0.1:3100/test-audio/2.wav?seconds=180',
      cover_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#7c3aed"/></svg>'),
      published: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'track-np-3',
      title: 'Solar Winds',
      artist: 'Aether Wave',
      album: 'Cosmic Journey',
      duration: 240,
      audio_url: 'http://127.0.0.1:3100/test-audio/3.wav?seconds=240',
      cover_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#f59e0b"/></svg>'),
      published: true,
      created_at: new Date().toISOString()
    }
  ]

  await page.goto('/music')
  await page.getByRole('button', { name: /Play Echoes of the Starlight/i }).first().click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

  // Open Now Playing
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await expect(dialog).toBeVisible()
  return { dialog, data }
}

test.describe('Now Playing Sizing & Viewport Fit Suite', () => {
  test('fits completely within single viewport on 1440x900 without page scroll', async ({ page }) => {
    const { dialog } = await preparePlayer(page, { width: 1440, height: 900 })

    // 1. All critical playback elements must be simultaneously visible
    await expect(dialog.locator('.sv-np-header')).toBeVisible()
    await expect(dialog.locator('.sv-np-artwork-frame')).toBeVisible()
    await expect(dialog.locator('.sv-np-track-title')).toBeVisible()
    await expect(dialog.locator('.sv-np-track-artist')).toBeVisible()
    await expect(dialog.locator('.sv-np-progress-bar')).toBeVisible()
    await expect(dialog.locator('.sv-np-hero-play-btn')).toBeVisible()
    await expect(dialog.locator('.sv-np-card-header')).toBeVisible()
    await expect(dialog.locator('.sv-np-card-body')).toBeVisible()
    await expect(dialog.locator('.sv-np-card-volume')).toBeVisible()

    // 2. Playback controls must be inside viewport without scrolling
    const playBtnBox = await dialog.locator('.sv-np-hero-play-btn').boundingBox()
    expect(playBtnBox.y + playBtnBox.height).toBeLessThanOrEqual(900)

    // 3. Queue volume control must be inside viewport without scrolling
    const volBox = await dialog.locator('.sv-np-card-volume').boundingBox()
    expect(volBox.y + volBox.height).toBeLessThanOrEqual(900)

    // 4. Check that dialog itself does NOT have vertical scrollbar
    const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 2)
    expect(isScrollable).toBe(false)

    // 5. Artwork follows compact 350–380px desktop focal scale (NOT 440–500px)
    const artBox = await dialog.locator('.sv-np-artwork-frame').boundingBox()
    expect(artBox.width).toBeGreaterThanOrEqual(320)
    expect(artBox.width).toBeLessThanOrEqual(395)
    expect(artBox.height).toBeLessThanOrEqual(525)

    // 6. Queue card bounds: 540-590px wide, 500-650px high
    const queueBox = await dialog.locator('.sv-np-glass-card').boundingBox()
    expect(queueBox.width).toBeGreaterThanOrEqual(520)
    expect(queueBox.width).toBeLessThanOrEqual(600)
    expect(queueBox.height).toBeGreaterThanOrEqual(500)
    expect(queueBox.height).toBeLessThanOrEqual(650)

    // 6b. Distance between tabs and Queue is within 24-56px (target 28-56px)
    const tabsBox = await dialog.locator('.sv-np-tabs').boundingBox()
    const gap = queueBox.y - (tabsBox.y + tabsBox.height)
    expect(gap).toBeGreaterThanOrEqual(24)
    expect(gap).toBeLessThanOrEqual(56)

    // 7. Queue item rows: compact 72-82px single row
    const firstRowBox = await dialog.locator('.sv-queue-item').first().boundingBox()
    expect(firstRowBox.height).toBeGreaterThanOrEqual(68)
    expect(firstRowBox.height).toBeLessThanOrEqual(82)

    // 8. Main play button: 56-64px
    expect(playBtnBox.width).toBeGreaterThanOrEqual(56)
    expect(playBtnBox.width).toBeLessThanOrEqual(64)

    // 9. Track list owns the scrollbar
    const listOverflow = await dialog.locator('.sv-np-card-body').evaluate(el => window.getComputedStyle(el).overflowY)
    expect(['auto', 'scroll']).toContain(listOverflow)

    // Capture screenshots
    await dialog.screenshot({ path: `${output}/now-playing-desktop-1440x900.png` })
  })

  test('fits completely within single viewport on 1366x768 without page scroll', async ({ page }) => {
    const { dialog } = await preparePlayer(page, { width: 1366, height: 768 })

    // Controls must fit inside 768px height
    const playBtnBox = await dialog.locator('.sv-np-hero-play-btn').boundingBox()
    expect(playBtnBox.y + playBtnBox.height).toBeLessThanOrEqual(768)

    const volBox = await dialog.locator('.sv-np-card-volume').boundingBox()
    expect(volBox.y + volBox.height).toBeLessThanOrEqual(768)

    // Dialog has no page scroll
    const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 2)
    expect(isScrollable).toBe(false)

    // Artwork automatically reduced to 280-340px
    const artBox = await dialog.locator('.sv-np-artwork-frame').boundingBox()
    expect(artBox.width).toBeGreaterThanOrEqual(270)
    expect(artBox.width).toBeLessThanOrEqual(340)

    // Queue card scaled to 450-530px
    const queueBox = await dialog.locator('.sv-np-glass-card').boundingBox()
    expect(queueBox.height).toBeGreaterThanOrEqual(420)
    expect(queueBox.height).toBeLessThanOrEqual(530)

    await dialog.screenshot({ path: `${output}/now-playing-desktop-1366x768.png` })
  })

  test('fits completely on large 1920x1080 without over-stretching', async ({ page }) => {
    const { dialog } = await preparePlayer(page, { width: 1920, height: 1080 })

    const playBtnBox = await dialog.locator('.sv-np-hero-play-btn').boundingBox()
    expect(playBtnBox.y + playBtnBox.height).toBeLessThanOrEqual(1080)

    // Dialog has no page scroll
    const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 2)
    expect(isScrollable).toBe(false)

    // Artwork capped at max 430px
    const artBox = await dialog.locator('.sv-np-artwork-frame').boundingBox()
    expect(artBox.width).toBeLessThanOrEqual(430)

    // Queue capped at max 620px width
    const queueBox = await dialog.locator('.sv-np-glass-card').boundingBox()
    expect(queueBox.width).toBeLessThanOrEqual(620)

    await dialog.screenshot({ path: `${output}/now-playing-desktop-1920x1080.png` })
  })

  test('fits completely on compact 1280x720 height constraint', async ({ page }) => {
    const { dialog } = await preparePlayer(page, { width: 1280, height: 720 })

    const playBtnBox = await dialog.locator('.sv-np-hero-play-btn').boundingBox()
    expect(playBtnBox.y + playBtnBox.height).toBeLessThanOrEqual(720)

    const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 2)
    expect(isScrollable).toBe(false)

    await dialog.screenshot({ path: `${output}/now-playing-desktop-1280x720.png` })
  })

  test('fits on 1024x768 tablet landscape', async ({ page }) => {
    const { dialog } = await preparePlayer(page, { width: 1024, height: 768 })

    const playBtnBox = await dialog.locator('.sv-np-hero-play-btn').boundingBox()
    expect(playBtnBox.y + playBtnBox.height).toBeLessThanOrEqual(768)

    await dialog.screenshot({ path: `${output}/now-playing-tablet-1024x768.png` })
  })
})
