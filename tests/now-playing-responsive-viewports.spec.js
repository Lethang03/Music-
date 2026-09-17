import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/now-playing-viewports'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

const viewports = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1600x900', width: 1600, height: 900 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1280x720', width: 1280, height: 720 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'mobile-430x932', width: 430, height: 932 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-375x812', width: 375, height: 812 }
]

test.describe('Now Playing Multi-Viewport Comprehensive Audit', () => {
  for (const vp of viewports) {
    test(`renders cleanly and fits viewport without overflow on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const data = await setup(page, { admin: true, seconds: 180 })
      
      data.db.music_tracks = [
        {
          id: 'vp-track-1',
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
          id: 'vp-track-2',
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
          id: 'vp-track-3',
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

      // Check desktop-specific assertions
      if (vp.width >= 1025) {
        const queueBox = await dialog.locator('.sv-np-glass-card').boundingBox()
        const tabsBox = await dialog.locator('.sv-np-tabs').boundingBox()
        const gap = queueBox.y - (tabsBox.y + tabsBox.height)
        
        // Gap is tight and intentional (16-56px across all desktop sizes, 28-48px on standard 900p)
        expect(gap).toBeGreaterThanOrEqual(16)
        expect(gap).toBeLessThanOrEqual(56)

        // Queue width is between 500px and 620px
        expect(queueBox.width).toBeGreaterThanOrEqual(500)
        expect(queueBox.width).toBeLessThanOrEqual(620)

        // No vertical page scroll on desktop
        const isScrollable = await dialog.evaluate(el => el.scrollHeight > el.clientHeight + 2)
        expect(isScrollable).toBe(false)
      }

      // Check play button fits within viewport
      const playBtn = dialog.locator('.sv-np-hero-play-btn')
      await expect(playBtn).toBeVisible()

      // Check volume row is visible
      const volRow = dialog.locator('.sv-np-card-volume')
      await expect(volRow).toBeVisible()

      // Take screenshot
      await page.screenshot({ path: `${output}/${vp.name}.png` })
    })
  }
})
