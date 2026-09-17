import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import vm from 'node:vm'
import http from 'node:http'

const origin = 'https://app.test'
const shell = () => new Response('<!doctype html><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script>', { headers: { 'Content-Type': 'text/html' } })
const asset = () => new Response('export default 1', { headers: { 'Content-Type': 'text/javascript' } })

function worker() {
  const handlers = {}, stores = new Map(), state = { online: true, network: async () => shell(), skipped: 0, claimed: 0 }
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map())
      const rows = stores.get(name)
      return {
        match: async request => rows.get(key(request))?.clone(),
        put: async (request, response) => rows.set(key(request), response.clone()),
        keys: async () => [...rows.keys()].map(url => new Request(url)),
        add: async request => { const response = await state.network(request); if (!response.ok) throw Error('install failed'); rows.set(key(request), response.clone()) }
      }
    }
  }
  class WorkerRequest extends Request { constructor(url, options) { super(new URL(url, origin), options) } }
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin }, navigator: { get onLine() { return state.online } },
      addEventListener: (name, callback) => { handlers[name] = callback },
      skipWaiting: async () => { state.skipped++ }, clients: { claim: async () => { state.claimed++ } } },
    caches, URL, Request: WorkerRequest, Response, fetch: request => state.network(request)
  })
  return { state, caches, stores,
    async lifecycle(name) { let pending; handlers[name]({ waitUntil: promise => { pending = promise } }); await pending },
    async request(path = '/music', options = {}) {
      let result
      handlers.fetch({ request: { url: origin + path, method: 'GET', mode: 'navigate', headers: new Headers(), ...options }, respondWith: promise => { result = promise } })
      return result
    }
  }
}

test('online navigation is cached and reused for deep routes after transient failure', async () => {
  const w = worker()
  expect((await w.request()).status).toBe(200)
  w.state.network = async () => { throw Error('temporary failure') }
  const cached = await w.request('/podcasts/123')
  expect(await cached.text()).toContain('id="root"')
  w.state.online = false
  expect(await (await w.request('/admin')).text()).toContain('id="root"')
})

test('only true offline with no shell uses offline HTML; online failure gets neutral 503', async () => {
  const w = worker()
  w.state.network = async request => new URL(request.url).pathname === '/offline.html' ? new Response('offline-only') : shell()
  await w.lifecycle('install')
  w.state.network = async () => { throw Error('unreachable') }
  expect((await w.request()).status).toBe(503)
  expect(await (await w.request()).text()).not.toContain("You're offline")
  w.state.online = false
  expect(await (await w.request()).text()).toBe('offline-only')
  w.state.online = true
  w.state.network = async () => shell()
  expect(await (await w.request()).text()).toContain('id="root"')
})

for (const status of [401, 403, 404, 500, 503]) test(`HTTP ${status} is returned unchanged and never poisons cached shell`, async () => {
  const w = worker()
  await w.request()
  w.state.network = async () => new Response('upstream error', { status })
  expect((await w.request()).status).toBe(status)
  w.state.network = async () => { throw Error('unreachable') }
  expect(await (await w.request()).text()).toContain('id="root"')
})

test('opaque responses and fake 200 fallback pages never become app shells', async () => {
  const w = worker()
  for (const response of [new Response('offline page', { headers: { 'Content-Type': 'text/html' } }), { status: 0, type: 'opaque' }]) {
    w.state.network = async () => response
    expect(await w.request()).toBe(response)
  }
  w.state.network = async () => { throw Error('unreachable') }
  expect((await w.request()).status).toBe(503)
})

test('API, Edge Functions, CORS-mode requests and audio ranges bypass the worker', async () => {
  const w = worker()
  w.state.network = async () => { throw Error('must not intercept') }
  for (const path of ['/rest/v1/tracks', '/functions/v1/import', '/audio/test.mp3']) {
    expect(await w.request(path, { mode: 'cors' })).toBeUndefined()
  }
  expect(await w.request('/assets/index-abc123.js', { mode: 'cors', headers: new Headers({ Range: 'bytes=0-10' }) })).toBeUndefined()
})

test('update warms shell/assets, removes old cache and preserves immutable assets for open tabs', async () => {
  const w = worker()
  const old = await w.caches.open('soundverse-v2-cache-v3')
  await old.put('/', new Response('stale offline page'))
  await old.put('/assets/old-123abc.js', asset())
  await w.caches.open('unrelated-app')
  w.state.network = async request => {
    const path = new URL(request.url).pathname
    return path === '/offline.html' ? new Response('offline') : path.startsWith('/assets/') ? asset() : shell()
  }
  await w.lifecycle('install')
  await w.lifecycle('activate')
  expect(w.state.skipped).toBe(1)
  expect(w.state.claimed).toBe(1)
  expect(await w.caches.keys()).toEqual(['unrelated-app', 'soundverse-v2-cache-v4'])
  w.state.network = async () => { throw Error('unreachable') }
  expect(await (await w.request()).text()).toContain('id="root"')
  expect((await w.request('/assets/index-abc123.js', { mode: 'cors' })).status).toBe(200)
  expect((await w.request('/assets/old-123abc.js', { mode: 'cors' })).status).toBe(200)
})

test('cache storage failures do not replace valid network responses', async () => {
  const w = worker()
  w.caches.open = async () => { throw Error('quota') }
  expect((await w.request()).status).toBe(200)
  w.state.network = async () => { throw Error('unreachable') }
  expect((await w.request()).status).toBe(503)
})

test('failed install navigation preserves a validated old shell during update', async () => {
  const w = worker()
  const old = await w.caches.open('soundverse-v2-cache-v3')
  await old.put('/', shell())
  await old.put('/assets/index-abc123.js', asset())
  w.state.network = async request => {
    if (new URL(request.url).pathname === '/offline.html') return new Response('offline')
    throw Error('temporary install failure')
  }
  await w.lifecycle('install')
  await w.lifecycle('activate')
  expect(await (await w.request()).text()).toContain('id="root"')
  expect(await w.caches.keys()).toEqual(['soundverse-v2-cache-v4'])
})

test('real Chrome worker serves cached shell on failed navigation and recovers from true offline', async ({ page, context }) => {
  let failNavigation = false
  const server = http.createServer((request, response) => {
    if (request.url === '/sw.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(fs.readFileSync('public/sw.js'))
    } else if (request.url === '/offline.html') {
      response.setHeader('Content-Type', 'text/html')
      response.end(fs.readFileSync('public/offline.html'))
    } else if (request.url.startsWith('/assets/')) {
      response.setHeader('Content-Type', 'text/javascript')
      response.end('document.getElementById("root").textContent = "App shell booted";')
    } else if (failNavigation) {
      request.socket.destroy()
    } else {
      response.setHeader('Content-Type', 'text/html')
      response.end('<!doctype html><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script>')
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    await page.goto(base + '/music')
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    })
    failNavigation = true
    const navigation = await page.goto(base + '/podcasts')
    expect(navigation.fromServiceWorker()).toBe(true)
    await expect(page.locator('#root')).toHaveText('App shell booted')
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)
    await context.setOffline(true)
    await page.goto(base + '/music')
    await expect(page.locator('#root')).toHaveText('App shell booted')
    // Only after losing the cached shell is the offline document appropriate.
    await page.evaluate(async () => (await caches.open('soundverse-v2-cache-v4')).delete('/'))
    await page.goto(base + '/podcasts')
    await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()
    failNavigation = false
    await context.setOffline(false)
    await expect(page.locator('#root')).toHaveText('App shell booted')
    await expect(page).toHaveURL(base + '/podcasts')
  } finally {
    await context.setOffline(false)
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
