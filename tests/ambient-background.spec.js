import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/ui-redesign'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

// Helper to create distinct SVG data URIs for covers
function createCoverSvg(color1, color2, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="300" cy="300" r="180" fill="rgba(0,0,0,0.3)"/>
    <circle cx="300" cy="300" r="70" fill="${color1}"/>
    <text x="300" y="520" font-family="sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

test('dynamic ambient background transitions across diverse track artworks and moon button is removed', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1440, height: 900 })

  const data = await setup(page, { admin: true, seconds: 200 })

  const covers = [
    { title: 'Forest Awakening', artist: 'Sylvan Waves', c1: '#059669', c2: '#10b981', label: 'GREEN' },
    { title: 'Ocean Deep', artist: 'Marine Echoes', c1: '#0284c7', c2: '#06b6d4', label: 'BLUE' },
    { title: 'Sunset Boulevard', artist: 'Solar Drift', c1: '#ea580c', c2: '#f59e0b', label: 'ORANGE' },
    { title: 'Neon Velvet', artist: 'Violet Sky', c1: '#c026d3', c2: '#ec4899', label: 'PINK' },
    { title: 'Obsidian Night', artist: 'Dark Matter', c1: '#1e293b', c2: '#0f172a', label: 'DARK' }
  ]

  data.db.music_tracks = covers.map((c, i) => ({
    id: `track-${i + 1}`,
    title: c.title,
    artist: c.artist,
    album: 'Atmospheres',
    duration: 180,
    audio_url: `http://127.0.0.1:3100/test-audio/${i + 1}.wav?seconds=180`,
    cover_url: createCoverSvg(c.c1, c.c2, c.label),
    synced_lyrics: null,
    lyrics: 'Instrumental track with rich ambient atmosphere.',
    published: true,
    created_at: new Date().toISOString()
  }))

  await page.goto('/music')
  await expect(page.locator('.music-hero')).toBeVisible()

  // Start playing the first track (Forest Awakening - Green)
  await page.getByRole('button', { name: 'Play Forest Awakening', exact: true }).click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

  // Open the redesigned Now Playing screen
  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await expect(dialog).toBeVisible()

  // 1. Verify Moon button is COMPLETELY REMOVED from DOM
  expect(await dialog.locator('.sv-theme-btn').count()).toBe(0)
  expect(await dialog.locator('.sv-np-right-accents').count()).toBe(0)
  expect(await dialog.locator('.sv-edge-text').count()).toBe(0)

  // 2. Verify header tagline
  await expect(dialog.getByText('LET THE MUSIC STAY WITH YOU').first()).toBeVisible()

  // 3. Verify Track 1: Green Forest Cover
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Forest Awakening')
  await expect(dialog.locator('.sv-np-blur-image').first()).toBeVisible()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${output}/ambient-track-green.png` })

  // 4. Transition to Track 2: Blue Ocean Cover
  await dialog.getByTitle('Next', { exact: true }).click()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Ocean Deep')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${output}/ambient-track-blue.png` })

  // 5. Transition to Track 3: Orange Sunset Cover
  await dialog.getByTitle('Next', { exact: true }).click()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Sunset Boulevard')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${output}/ambient-track-orange.png` })

  // 6. Transition to Track 4: Pink Neon Cover
  await dialog.getByTitle('Next', { exact: true }).click()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Neon Velvet')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${output}/ambient-track-pink.png` })

  // 7. Transition to Track 5: Dark Monochrome Cover
  await dialog.getByTitle('Next', { exact: true }).click()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Obsidian Night')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${output}/ambient-track-dark.png` })

  // 8. Verify readability, queue and controls remain responsive
  await expect(dialog.getByTitle('Pause', { exact: true })).toBeVisible()
  await expect(dialog.locator('.sv-np-glass-card')).toBeVisible()
  await expect(dialog.getByText('UP NEXT')).toBeVisible()

  // Check zero overflow
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
})

function createScenicOceanCatSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4a6fa5"/>
        <stop offset="40%" stop-color="#3d5a80"/>
        <stop offset="70%" stop-color="#243354"/>
        <stop offset="100%" stop-color="#14213d"/>
      </linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1b3b6f"/>
        <stop offset="50%" stop-color="#0f2854"/>
        <stop offset="100%" stop-color="#08142a"/>
      </linearGradient>
    </defs>
    <rect width="800" height="440" fill="url(#sky)"/>
    <path d="M 220 120 Q 235 105 250 120 Q 265 105 280 120 Q 265 115 250 125 Q 235 115 220 120 Z" fill="#0d1b2a"/>
    <path d="M 460 160 Q 480 140 500 160 Q 520 140 540 160 Q 520 152 500 168 Q 480 152 460 160 Z" fill="#0d1b2a"/>
    <path d="M 660 100 Q 675 85 690 100 Q 705 85 720 100 Q 705 95 690 105 Q 675 95 660 100 Z" fill="#0d1b2a"/>
    <rect y="440" width="800" height="360" fill="url(#sea)"/>
    <ellipse cx="400" cy="510" rx="360" ry="12" fill="rgba(255,255,255,0.06)"/>
    <ellipse cx="400" cy="580" rx="380" ry="16" fill="rgba(255,255,255,0.05)"/>
    <rect x="0" y="0" width="45" height="800" fill="#0a0e1a"/>
    <rect x="755" y="0" width="45" height="800" fill="#0a0e1a"/>
    <path d="M 540 800 C 530 720 560 675 590 675 C 600 650 612 620 630 620 C 640 600 655 600 665 620 C 685 620 695 650 705 675 C 735 675 765 720 755 800 Z" fill="#080c18"/>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

test('scenic artwork with ocean, birds and cat silhouette expands recognizably into ambient background on desktop and mobile', async ({ page }) => {
  test.setTimeout(90000)
  const data = await setup(page, { admin: true, seconds: 200 })

  data.db.music_tracks = [
    {
      id: 'scenic-track-1',
      title: 'Ocean Window & Flying Birds',
      artist: 'Silent Evening',
      album: 'Window Views',
      duration: 210,
      audio_url: 'http://127.0.0.1:3100/test-audio/1.wav?seconds=210',
      cover_url: createScenicOceanCatSvg(),
      synced_lyrics: null,
      lyrics: 'Watching birds glide across the blue sea into the twilight.',
      published: true,
      created_at: new Date().toISOString()
    }
  ]

  // Test Desktop 1440x900
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/music')
  await expect(page.locator('.music-hero')).toBeVisible()

  await page.getByRole('button', { name: 'Play Ocean Window & Flying Birds', exact: true }).click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()

  await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Now playing' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.sv-np-track-title')).toHaveText('Ocean Window & Flying Birds')

  // Verify ambient image is present and visible with cover URL
  const ambientImg = dialog.locator('.sv-np-ambient-img').first()
  await expect(ambientImg).toBeVisible()
  expect(await ambientImg.getAttribute('src')).toContain('data:image/svg+xml')

  // Main album artwork must remain sharp and distinct
  const mainArt = dialog.locator('.sv-np-artwork-img')
  await expect(mainArt).toBeVisible()

  await page.waitForTimeout(600)
  await page.screenshot({ path: `${output}/ambient-scenic-ocean-cat-desktop.png` })

  // Test Mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: `${output}/ambient-scenic-ocean-cat-mobile.png` })
})

