import { test, expect } from '@playwright/test'
import { setup } from './fixtures'
import fs from 'node:fs'

const output = 'audit/home-podcast-final/legacy'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))

test.describe('Cosmic Podcast Hero Redesign Suite', () => {
  test('renders cosmic podcast hero with real data on desktop (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const data = await setup(page, { admin: true, seconds: 180 })

    await page.goto('/podcasts')
    const hero = page.locator('.podcast-hero')
    await expect(hero).toBeVisible()

    // Eyebrow badge
    const eyebrow = hero.locator('.podcast-eyebrow-badge')
    await expect(eyebrow).toBeVisible()
    await expect(eyebrow).toContainText('STORIES THAT STAY WITH YOU')

    // Giant Headline
    await expect(hero.locator('.podcast-brand-title')).toContainText('Podcast')
    await expect(hero.locator('.podcast-dot')).toBeVisible()
    await expect(hero.locator('.podcast-sub-title')).toContainText('Những câu chuyện')
    await expect(hero.locator('.podcast-gradient-title')).toContainText('đáng để lắng nghe.')

    // Subtitle / Description
    await expect(hero.locator('.podcast-hero-desc')).toContainText('Từ những phút thư giãn')

    // Buttons
    const playBtn = hero.locator('.podcast-btn-play')
    const exploreBtn = hero.locator('.podcast-btn-explore')
    await expect(playBtn).toBeVisible()
    await expect(playBtn).toContainText('Nghe ngay')
    await expect(exploreBtn).toBeVisible()
    await expect(exploreBtn).toContainText('Khám phá Podcast')

    // 3 Real Podcast Statistics
    const showsStat = hero.locator('.stat-shows')
    const episodesStat = hero.locator('.stat-episodes')
    const timeStat = hero.locator('.stat-time')

    await expect(showsStat).toBeVisible()
    await expect(episodesStat).toBeVisible()
    await expect(timeStat).toBeVisible()

    const expectedShowsCount = String(data.db.podcasts.length)
    const expectedEpisodesCount = String(data.db.episodes.length)
    await expect(showsStat.locator('.stat-num')).toHaveText(expectedShowsCount)
    await expect(episodesStat.locator('.stat-num')).toHaveText(expectedEpisodesCount)

    // 3D Centerpiece installation
    await expect(hero.locator('.podcast-stage')).toBeVisible()
    await expect(hero.locator('.podcast-mic-container')).toBeVisible()
    await expect(hero.locator('.podcast-mic-image')).toBeVisible()
    await expect(hero.locator('.cover-main')).toBeVisible()
    await expect(hero.locator('.cover-left')).toBeVisible()
    await expect(hero.locator('.cover-right')).toBeVisible()
    await expect(hero.locator('.podcast-waveform')).toBeVisible()
    await expect(hero.locator('.podcast-signature-quote')).toContainText('Good Conversations')
    await expect(hero.locator('.podcast-identity-badge')).toContainText('SOUNDVERSE')

    // Category filters placed below the hero
    const filterRow = page.locator('.v2-filter-row')
    await expect(filterRow).toBeVisible()

    // Verify filter row is positioned after hero in DOM
    const heroBox = await hero.boundingBox()
    const filterBox = await filterRow.boundingBox()
    expect(filterBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height - 10)

    // Screenshots
    await hero.screenshot({ path: `${output}/podcast-hero-desktop-1440.png` })
    await page.screenshot({ path: `${output}/podcast-page-desktop-1440.png` })
  })

  test('clicking Nghe ngay starts audio playback and activates waveform animation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/podcasts')
    const hero = page.locator('.podcast-hero')
    await expect(hero).toBeVisible()

    const waveform = hero.locator('.podcast-waveform')
    await expect(waveform).toHaveClass(/is-idle/)

    // Click "Nghe ngay"
    const playBtn = hero.locator('.podcast-btn-play')
    await playBtn.click()

    // Waveform transitions to playing state or button text updates
    await expect(waveform).toHaveClass(/is-playing/, { timeout: 5000 })
    await hero.screenshot({ path: `${output}/podcast-hero-playing-state.png` })
  })

  test('renders responsive podcast hero on tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/podcasts')
    const hero = page.locator('.podcast-hero')
    await expect(hero).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await hero.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    await hero.screenshot({ path: `${output}/podcast-hero-tablet-768.png` })
  })

  test('renders responsive podcast hero without overflow on mobile (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setup(page, { admin: true, seconds: 180 })

    await page.goto('/podcasts')
    const hero = page.locator('.podcast-hero')
    await expect(hero).toBeVisible()

    // Strict overflow assertions
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await hero.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)

    // Verify 3 stat cards on mobile
    await expect(hero.locator('.stat-shows')).toBeVisible()
    await expect(hero.locator('.stat-episodes')).toBeVisible()
    await expect(hero.locator('.stat-time')).toBeVisible()

    await hero.screenshot({ path: `${output}/podcast-hero-mobile-390.png` })
    await page.screenshot({ path: `${output}/podcast-page-mobile-390.png` })
  })
})
