import { test, expect } from '@playwright/test'
import { setup, playerBar } from './fixtures'
import fs from 'node:fs'

const output = 'audit/ui-redesign'
test.beforeAll(() => fs.mkdirSync(output, { recursive: true }))
async function shot(page, name) { await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' }) }
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await page.locator('.v2-main-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
}
async function prepare(page) {
  const data = await setup(page, { admin: true, seconds: 180 })
  const names = ['Midnight in Motion', 'A Different Kind of Blue', 'After the Rain']
  data.db.music_tracks.forEach((track, i) => {
    track.title = names[i]; track.artist = ['Luna Park', 'North Atlantic', 'Slow Signals'][i]
    track.album = ['Night Drive', 'Open Water', 'Still Here'][i]
    track.synced_lyrics = Array.from({ length: 12 }, (_, n) => ({ start: n * 10, end: n * 10 + 10, text: ['Let the city fade behind us', 'We are moving with the light', 'Every sound becomes a story', 'Somewhere in the quiet of the night'][n % 4] }))
  })
  return data
}
for (const [width, height] of [[390,844],[430,932],[768,1024],[1440,900],[1920,1080]]) {
  test(`interface layout and player at ${width}`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height })
    const { errors } = await prepare(page)
    await page.goto('/music')
    await expect(page.locator('.music-hero')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play Midnight in Motion', exact: true })).toBeVisible()
    await noOverflow(page)
    await shot(page, `music-${width}`)
    await page.getByRole('button', { name: 'Play Midnight in Motion', exact: true }).click()
    await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()
    await page.evaluate(() => { window.uiAudio = window.testAudio.find(a => a.src) })
    if (width <= 768) {
      const mini = await playerBar(page).boundingBox(), nav = await page.locator('.v2-bottom-nav').boundingBox()
      expect(mini.y + mini.height).toBeLessThanOrEqual(nav.y)
    }
    await playerBar(page).getByTitle('Open Now Playing', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Now playing' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTitle('Pause', { exact: true })).toBeInViewport()
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    await shot(page, `player-${width}`)
    await dialog.getByRole('button', { name: 'Lyrics', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Following lyrics' })).toBeInViewport()
    await expect(dialog.locator('.v2-synced-lyrics')).toBeVisible()
    expect(await dialog.locator('.v2-synced-lyrics').evaluate(el => el.clientHeight)).toBeGreaterThan(100)
    await shot(page, `lyrics-${width}`)
    await dialog.getByRole('button', { name: 'Queue', exact: true }).click()
    await dialog.getByRole('button', { name: 'Move Midnight in Motion down' }).click()
    await expect(dialog.locator('.v2-np-queue-meta strong').first()).toHaveText('A Different Kind of Blue')
    expect(await page.evaluate(() => window.uiAudio === window.testAudio.find(a => a.src))).toBe(true)
    await dialog.getByTitle('Close', { exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.locator('.v2-topbar').getByRole('link', { name: 'Profile' }).click()
    await expect(page.locator('.profile-page')).toBeVisible()
    await noOverflow(page)
    await page.locator('.v2-stats-grid').scrollIntoViewIfNeeded()
    const stats = await page.locator('.v2-stats-grid').boundingBox(), mini = await playerBar(page).boundingBox()
    expect(stats.y + stats.height).toBeLessThanOrEqual(mini.y)
    await shot(page, `profile-${width}`)
    await page.locator('.profile-page').getByRole('link', { name: 'Admin Dashboard' }).click()
    await expect(page.locator('.v2-admin-table')).toBeVisible()
    await noOverflow(page)
    if (width <= 768) {
      await expect(page.getByRole('navigation', { name: 'Admin sections' })).toBeInViewport()
      await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Import Music' })).toBeVisible()
      expect(await page.locator('.v2-admin-table th').evaluateAll(els => els.every(el => getComputedStyle(el).display !== 'none'))).toBe(true)
    }
    await shot(page, `admin-${width}`)
    expect(errors).toEqual([])
  })
}

test('reduced motion and simulated safe-area reserve usable bottom space', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 })
  await page.emulateMedia({ reducedMotion:'reduce' })
  await prepare(page)
  await page.goto('/music')
  await page.addStyleTag({ content: ':root{--safe-bottom:34px}' })
  await page.getByRole('button', { name: 'Play Midnight in Motion', exact: true }).click()
  const mini = await playerBar(page).boundingBox(), nav = await page.locator('.v2-bottom-nav').boundingBox()
  expect(mini.y + mini.height).toBeLessThanOrEqual(nav.y)
  expect(nav.height).toBe(98)
  expect(await page.locator('.music-bars i').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none')
})

test('mobile admin editor labels and final actions remain reachable above player', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 })
  await prepare(page)
  await page.goto('/music')
  await page.getByRole('button', { name: 'Play Midnight in Motion', exact: true }).click()
  await page.locator('.v2-topbar').getByRole('link', { name: 'Profile' }).click()
  await page.locator('.profile-page').getByRole('link', { name: 'Admin Dashboard' }).click()
  await page.getByRole('button', { name: 'Add content' }).click()
  await page.getByLabel('title', { exact:true }).fill('A new track with a longer title')
  await noOverflow(page)
  await expect(page.getByText('Title *', { exact:true })).toBeVisible()
  await shot(page, 'admin-editor-390')
  const save = page.getByRole('button', { name: 'Save content', exact:true })
  await save.scrollIntoViewIfNeeded()
  const action = await save.boundingBox(), mini = await playerBar(page).boundingBox()
  expect(action.y + action.height).toBeLessThanOrEqual(mini.y)
  await shot(page, 'admin-editor-actions-390')
})
