import { test, expect } from '@playwright/test'
import { setup, playFirst } from './fixtures'
import fs from 'node:fs'
import vm from 'node:vm'

async function connectivity(page, online, event) {
  await page.evaluate(({ online, event }) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
    if (event) window.dispatchEvent(new Event(event))
  }, { online, event })
}
const offline = page => page.getByRole('heading', { name: "You're offline", exact: true })

test('initial browser offline state shows offline screen', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }))
  await page.goto('/music')
  await expect(offline(page)).toBeVisible()
})

test('a stale fallback document recovers the original route when server returns', async ({ page }) => {
  await setup(page)
  let first = true
  await page.route('**/podcasts', route => {
    if (first) {
      first = false
      return route.fulfill({ contentType: 'text/html', body: fs.readFileSync('public/offline.html', 'utf8') })
    }
    return route.continue()
  })
  await page.goto('/podcasts')
  await expect(page.locator('.v2-topbar')).toBeVisible()
  await expect(page).toHaveURL(/\/podcasts$/)
  await expect(offline(page)).toHaveCount(0)
})

test('online success, offline retry, automatic recovery preserve route and audio', async ({ page }) => {
  await setup(page, { seconds: 60 })
  await playFirst(page)
  await expect(offline(page)).toHaveCount(0)
  await page.evaluate(() => { window.originalAudio = window.testAudio.find(a => a.src) })
  let profiles = 0, tracks = 0
  page.on('request', r => { if (r.url().includes('/rest/v1/profiles')) profiles++; if (r.url().includes('/rest/v1/music_tracks')) tracks++ })
  await connectivity(page, false, 'offline')
  await expect(offline(page)).toBeVisible()
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(offline(page)).toBeVisible()
  await connectivity(page, true, 'online')
  await expect(offline(page)).toHaveCount(0)
  await expect.poll(() => profiles).toBeGreaterThan(0)
  await expect.poll(() => tracks).toBeGreaterThan(0)
  await expect(page).toHaveURL(/\/music$/)
  expect(await page.evaluate(() => window.originalAudio === window.testAudio.find(a => a.src) && !window.originalAudio.paused)).toBe(true)
})

test('manual recovery without online event', async ({ page }) => {
  await setup(page)
  await page.goto('/podcasts')
  await expect(page.locator('.v2-topbar')).toBeVisible()
  await connectivity(page, false, 'offline')
  await connectivity(page, true)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(offline(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/podcasts$/)
  await expect(page.getByText('Fixture podcast').first()).toBeVisible()
})

test('Supabase 500 keeps shell and retry restores catalog', async ({ page }) => {
  await setup(page)
  await page.route('**/rest/v1/music_tracks*', r => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Server failed"}' }))
  await page.goto('/music')
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load' })).toBeVisible()
  await expect(offline(page)).toHaveCount(0)
  await expect(page.locator('.v2-topbar')).toBeVisible()
  await page.unroute('**/rest/v1/music_tracks*')
  await page.getByRole('alert').filter({ hasText: 'Unable to load' }).getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.v2-premium-card').filter({ hasText: 'Track 1' })).toBeVisible()
})

test('Edge Function failure does not change connectivity', async ({ page }) => {
  await setup(page)
  await page.route('**/functions/v1/**', r => r.abort('failed'))
  await page.goto('/music')
  await expect(page.locator('.v2-topbar')).toBeVisible()
  await page.evaluate(() => fetch('https://soundverse-test.supabase.co/functions/v1/test').catch(() => {}))
  await expect(offline(page)).toHaveCount(0)
})

test('fallback reports browser connectivity and retries without an offline reload loop', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }))
  await page.goto('/offline.html')
  await expect(offline(page)).toBeVisible()
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(offline(page)).toBeVisible()
  await connectivity(page, true, 'online')
  await expect(page.getByRole('heading', { name: 'SoundVerse could not be loaded' })).toBeVisible()
})

test('worker prefers network, ignores stale cross-cache fallback and passes API/audio through', async () => {
  const handlers = {}, response = new Response('Server error', { status: 500 }), fallback = new Response('Offline document')
  let fail = false, result, cacheName
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { navigator: { onLine: false }, location: { origin: 'https://app.test' }, addEventListener: (name, fn) => { handlers[name] = fn } },
    URL, Response, fetch: async () => { if (fail) throw Error('failed'); return response },
    caches: { open: async name => { cacheName = name; return { match: async key => key === '/offline.html' ? fallback : undefined } }, match: () => { throw Error('stale cache consulted') } }
  })
  const event = { request: { method: 'GET', mode: 'navigate', headers: new Headers(), url: 'https://app.test/music' }, respondWith: promise => { result = promise } }
  handlers.fetch(event)
  expect(await result).toBe(response)
  fail = true; handlers.fetch(event)
  expect(await result).toBe(fallback)
  expect(cacheName).toContain('soundverse-')
  result = null
  handlers.fetch({ ...event, request: { ...event.request, mode: 'cors' } })
  expect(result).toBeNull()
})
