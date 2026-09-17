import { test, expect } from '@playwright/test'
import { setup } from './fixtures'
import fs from 'node:fs'

const output = 'audit/home-podcast-final/legacy'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

test.describe('Cosmic Home Hero Redesign Suite', () => {
  test('renders cosmic home hero with real data on desktop (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const data = await setup(page, { admin: true, seconds: 180 })

    await page.goto('/')
    const hero = page.locator('.home-hero')
    await expect(hero).toBeVisible()

    // Dynamic greeting
    const greetingBadge = hero.locator('.home-greeting-badge')
    await expect(greetingBadge).toBeVisible()
    const greetingText = await greetingBadge.textContent()
    expect(greetingText).toMatch(/Good (Morning|Afternoon|Evening)/)

    // Headline
    await expect(hero.locator('.home-hero-headline')).toContainText('Âm nhạc và')
    await expect(hero.locator('.headline-gradient')).toContainText('những câu chuyện,')
    await expect(hero.locator('.home-hero-headline')).toContainText('ở cùng một nơi.')

    // Subtitle
    await expect(hero.locator('.home-hero-sub')).toContainText('Khám phá thế giới âm thanh theo cách của bạn.')

    // Buttons
    const randomBtn = hero.locator('.home-btn-play')
    const exploreBtn = hero.locator('.home-btn-explore')
    await expect(randomBtn).toBeVisible()
    await expect(randomBtn).toContainText('Phát ngẫu nhiên')
    await expect(exploreBtn).toBeVisible()
    await expect(exploreBtn).toContainText('Khám phá ngay')

    // 3 Real Music Statistics
    const tracksStat = hero.locator('.stat-tracks')
    const artistsStat = hero.locator('.stat-artists')
    const durationStat = hero.locator('.stat-duration')

    await expect(tracksStat).toBeVisible()
    await expect(artistsStat).toBeVisible()
    await expect(durationStat).toBeVisible()

    const expectedTracksCount = String(data.db.music_tracks.length)
    await expect(tracksStat.locator('.stat-value')).toHaveText(expectedTracksCount)

    // 3D Centerpiece installation
    await expect(hero.locator('.home-music-stage')).toBeVisible()
    await expect(hero.locator('.home-artwork-frame')).toBeVisible()
    await expect(hero.locator('.home-headphones-overlay')).toBeVisible()
    await expect(hero.locator('.home-vinyl')).toBeVisible()
    await expect(hero.locator('.home-handwritten-signature')).toContainText('Music')
    await expect(hero.locator('.home-identity-tag')).toContainText('SOUNDVERSE')

    // Screenshots
    await hero.screenshot({ path: `${output}/home-hero-desktop-1440.png` })
    await page.screenshot({ path: `${output}/home-page-desktop-1440.png` })
  })

  test('vinyl spins when random shuffle play is activated', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/')
    const hero = page.locator('.home-hero')
    await expect(hero).toBeVisible()

    const vinyl = hero.locator('.home-vinyl')
    await expect(vinyl).toHaveClass(/is-paused/)

    // Click "Phát ngẫu nhiên"
    const randomBtn = hero.locator('.home-btn-play')
    await randomBtn.click()

    // Vinyl should transition to spinning class
    await expect(vinyl).toHaveClass(/is-spinning/, { timeout: 5000 })
    await hero.screenshot({ path: `${output}/home-hero-playing-state.png` })
  })

  test('renders responsive home hero on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/')
    const hero = page.locator('.home-hero')
    await expect(hero).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await hero.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    await hero.screenshot({ path: `${output}/home-hero-tablet-768.png` })
  })

  test('renders responsive home hero without overflow on mobile (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/')
    const hero = page.locator('.home-hero')
    await expect(hero).toBeVisible()

    // Strict overflow assertions
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await hero.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    // Verify stats are visible
    await expect(hero.locator('.stat-tracks')).toBeVisible()
    await expect(hero.locator('.stat-artists')).toBeVisible()
    await expect(hero.locator('.stat-duration')).toBeVisible()

    await hero.screenshot({ path: `${output}/home-hero-mobile-390.png` })
    await page.screenshot({ path: `${output}/home-page-mobile-390.png` })
  })
})
