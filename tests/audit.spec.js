import { test, expect } from '@playwright/test'
import { setup, userId, playerBar, playFirst } from './fixtures'

test('search includes tracks beyond the default Supabase row limit', async ({ page }) => {
  const { db, catalog } = await setup(page)
  db.music_tracks = Array.from({ length: 1001 }, (_, index) => ({ ...catalog[0], id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, title: index === 1000 ? 'Beyond page limit' : `Catalog song ${index}` }))
  await page.goto('/search?q=Beyond%20page%20limit')
  await expect(page.locator('.v2-search-results')).toContainText('Beyond page limit')
})

test('cloud activity and new favorites sync together without server-only columns', async ({ page }) => {
  const { db, catalog } = await setup(page)
  const firstKey = `track:${catalog[0].id}`
  const row = { id: '55555555-5555-4555-8555-555555555555', user_id: userId, media_key: firstKey, item: catalog[0], liked: true, position: 1, duration: 12, completed: false, listened_seconds: 1, listening_days: [], played_at: null, updated_at: '2026-09-07T00:00:00Z', created_at: '2026-09-07T00:00:00Z', metadata: {}, activity_type: 'playback' }
  db.soundverse_activity.push(row)
  await page.addInitScript(({ id, row, firstKey, second }) => localStorage.setItem(`soundverse_activity:${id}`, JSON.stringify({ rows: { [firstKey]: { ...row, liked: false }, [`track:${second.id}`]: { user_id: id, media_key: `track:${second.id}`, item: second, liked: true, updated_at: '2026-09-08T00:00:00Z' } }, dirty: [firstKey, `track:${second.id}`] })), { id: userId, row, firstKey, second: catalog[1] })
  const payloads = []
  page.on('request', request => { if (request.url().includes('/soundverse_activity?') && request.method() === 'POST') payloads.push(request.postDataJSON()) })
  await page.goto('/library')
  await expect.poll(() => db.soundverse_activity.length).toBe(2)
  expect(db.soundverse_activity[0].liked).toBe(false)
  expect(payloads[0][0]).not.toHaveProperty('id')
  expect(payloads[0][0]).not.toHaveProperty('created_at')
  await expect(page.getByText('cloud sync failed', { exact: false })).toHaveCount(0)
})

test('missing profile is recovered using allowed fields and survives refresh', async ({ page }) => {
  const { db, errors } = await setup(page)
  db.profiles = []
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Listener', exact: true })).toBeVisible()
  await expect.poll(() => db.profiles.length).toBe(1)
  expect(db.profiles[0].id).toBe(userId)
  expect(db.profiles[0]).not.toHaveProperty('email')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Listener', exact: true })).toBeVisible()
  await expect(page.getByText('Your profile could not be loaded.', { exact: false })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('profile write failure is visible and Retry profile actually recovers', async ({ page }) => {
  const { db, errors } = await setup(page)
  db.profiles = []
  let fail = true
  await page.route('**/rest/v1/profiles?**', async route => {
    if (fail && route.request().method() === 'POST') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Denied', code: '42501' }) })
    await route.fallback()
  })
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Retry profile' })).toBeVisible()
  expect(db.profiles).toEqual([])
  fail = false
  await page.getByRole('button', { name: 'Retry profile' }).click()
  await expect(page.getByRole('button', { name: 'Retry profile' })).toHaveCount(0)
  expect(db.profiles).toHaveLength(1)
  expect(errors).toEqual([])
})

test('logout removes persisted player and isolates a second account', async ({ page }) => {
  const { db, session, errors } = await setup(page)
  await playFirst(page)
  await playerBar(page).getByTitle('Favorite', { exact: true }).click()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Start Listening Now' })).toBeVisible()
  expect(await page.evaluate(id => [localStorage.getItem(`soundverse_player:${id}`), localStorage.getItem(`soundverse_activity:${id}`), localStorage.getItem('v2_playback_preferences')], userId)).toEqual([null, null, null])
  expect(await page.evaluate(() => window.testAudio.every(a => a.paused && !a.getAttribute('src')))).toBe(true)
  const second = '11111111-1111-4111-8111-111111111112'
  session.user = { ...session.user, id: second, email: 'second@example.test', user_metadata: { display_name: 'Second listener' } }
  db.profiles.push({ id: second, display_name: 'Second listener' })
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await page.locator('input[type=email]').fill('second@example.test')
  await page.locator('input[type=password]').fill('fixture-password')
  await page.getByRole('dialog').getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.locator('.v2-topbar')).toContainText('S')
  await expect(playerBar(page)).toHaveCount(0)
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Favorite content' }).locator('..')).not.toContainText('Track 1')
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Second listener' })).toBeVisible()
  expect(errors).toEqual([])
})

for (const [width, height] of [[390, 844], [375, 812]]) {
  test(`mobile podcast navigation, seasons, playback and refresh ${width}x${height}`, async ({ page }) => {
    const { errors } = await setup(page, { seconds: 30 })
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.locator('.v2-bottom-nav').getByRole('link', { name: 'Podcasts' }).click()
    await page.locator('.v2-premium-card').filter({ hasText: 'Fixture podcast' }).click()
    await expect(page.locator('.v2-ep-row').first()).toBeVisible()
    await page.locator('.v2-ep-row').filter({ hasText: 'Episode 1' }).click()
    await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()
    await expect(page.locator('.v2-bottom-nav')).toBeInViewport()
    expect(await page.locator('.v2-main-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `audit/podcast-${width}x${height}.png` })
    await page.reload()
    await expect(playerBar(page)).toContainText('Episode 1')
    await expect(playerBar(page).getByTitle('Play', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}
