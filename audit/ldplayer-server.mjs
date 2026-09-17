// Local-only, synthetic catalog/auth. No production account or database access.
import { createServer } from 'vite'
import { setup } from '../tests/fixtures.js'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const baseline = process.argv.includes('--baseline')
const routes = [], scripts = []
await setup({ route: async (match, fn) => routes.push({ match, fn }), addInitScript: async (fn, args) => scripts.push(`(${fn.toString()})(${JSON.stringify(args)})`), on() {} }, { seconds: 90, preferences: { volume: 0.7, shuffle: false, repeat: 'all', autoplay: true } })
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:3100'
process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_fixture'
const original = baseline ? execFileSync('git', ['show', 'HEAD:src/contexts/AudioContext.jsx'], { encoding: 'utf8' }) : null
const telemetry = `(() => {
  const Audio = window.Audio;
  window.Audio = function(...args) {
    const audio = new Audio(...args); let last = 0;
    for (const event of ['timeupdate','playing','pause','ended','error']) audio.addEventListener(event, () => {
      if (event === 'timeupdate' && performance.now() - last < 1000) return;
      last = performance.now();
      navigator.sendBeacon('/__telemetry', JSON.stringify({ event, time: audio.currentTime, duration: audio.duration, paused: audio.paused, src: audio.src, visibility: document.visibilityState, timestamp: Date.now() }));
    });
    return audio;
  }; window.Audio.prototype = Audio.prototype;
})()`
const server = await createServer({
  server: { host: '0.0.0.0', port: 3100, strictPort: true },
  plugins: [{
    name: 'ldplayer-fixture', enforce: 'pre',
    load(id) { if (baseline && id.replaceAll('\\', '/').endsWith('/src/contexts/AudioContext.jsx')) return original },
    transformIndexHtml() { return [{ tag: 'script', children: scripts.join(';').replaceAll('sb-soundverse-test-auth-token', 'sb-127-auth-token') + ';' + telemetry, injectTo: 'head-prepend' }] },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://127.0.0.1:3100')
        if (url.pathname === '/__telemetry') {
          let body = ''; for await (const chunk of req) body += chunk
          fs.writeFileSync('audit/ldplayer-live.json', body)
          fs.appendFileSync(`audit/ldplayer-${baseline ? 'baseline' : 'fixed'}-telemetry.jsonl`, body + '\n')
          res.writeHead(204); res.end(); return
        }
        const api = /^\/(auth|rest)\/v1\//.test(url.pathname)
        const matchURL = new URL(url)
        if (api) matchURL.hostname = 'soundverse-test.supabase.co'
        const route = routes.find(r => typeof r.match === 'function' ? r.match(matchURL) : r.match === '**/test-audio/**' && url.pathname.startsWith('/test-audio/'))
        if (!route) return next()
        let body = ''
        for await (const chunk of req) body += chunk
        try {
          await route.fn({ request: () => ({ url: () => matchURL.href, method: () => req.method, headers: () => req.headers, postDataJSON: () => JSON.parse(body || '{}') }), fulfill: ({ status = 200, contentType, headers = {}, body: response = '' }) => {
            res.writeHead(status, { ...(contentType ? { 'content-type': contentType } : {}), ...headers }); res.end(response)
          } })
        } catch (error) { res.writeHead(500); res.end(error.message) }
      })
    }
  }]
})
await server.listen()
console.log(`LDPLAYER ${baseline ? 'HEAD baseline' : 'working tree'} http://127.0.0.1:3100 (ADB reverse required)`)
