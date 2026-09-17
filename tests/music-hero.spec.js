import { test, expect } from '@playwright/test'
import { setup } from './fixtures'

for (const [width, height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[820,1180],[768,1024],[430,932],[390,844],[375,812],[360,800],[320,568]]) {
  test(`music reference hero at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({width,height})
    const {db} = await setup(page, {seconds:180})
    await page.goto('/music')
    const hero = page.locator('.music-reference-hero')
    await expect(hero).toBeVisible()
    await expect(hero.locator('.music-hero-title')).toContainText('những câu chuyện')
    await expect(hero.locator('.stat-card-tracks .stat-card-number')).toHaveText(String(db.music_tracks.length))
    await expect(hero.locator('.music-floating-tile img')).toBeVisible()
    expect(await hero.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await hero.locator('.music-hero-play').click()
    await expect(hero.locator('.music-hero-visualizer')).toHaveClass(/is-playing/)
  })
}
