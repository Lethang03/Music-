import { expect } from '@playwright/test'
export const userId = '11111111-1111-4111-8111-111111111111'
const art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><defs><linearGradient id="a"><stop stop-color="#c532ec"/><stop offset="1" stop-color="#284ac5"/></linearGradient></defs><rect width="320" height="320" fill="url(#a)"/><circle cx="160" cy="160" r="90" fill="#181126"/><circle cx="160" cy="160" r="25" fill="#c532ec"/></svg>')
export function tracks(seconds = 12) { return [1, 2, 3].map(n => ({ id: `22222222-2222-4222-8222-22222222222${n}`, title: `Track ${n}`, artist: 'Fixture artist', genre: n === 2 ? 'Rock' : 'Pop', audio_url: `http://127.0.0.1:3100/test-audio/${n}.wav?seconds=${seconds}`, cover_url: art, published: true, created_at: `2026-09-0${4-n}T00:00:00Z` })) }
function wav(seconds) {
  const count = Math.floor(8000 * seconds), b = Buffer.alloc(44 + count * 2)
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 8000) * 400), 44 + i * 2)
  return b
}
export async function setup(page, { signedIn = true, seconds = 12, admin = false, fail = '', player, preferences } = {}) {
  const user = { id: userId, email: 'listener@example.test', app_metadata: { role: admin ? 'admin' : 'user' }, user_metadata: { display_name: 'Listener' }, aud: 'authenticated', role: 'authenticated' }
  const payload = Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now()/1000)+7200 })).toString('base64url')
  const session = { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now()/1000)+7200, expires_in: 7200, token_type: 'bearer', user }
  const catalog = tracks(seconds)
  const podcastId = '33333333-3333-4333-8333-333333333333'
  const db = {
    music_tracks: catalog,
    podcasts: [{ id: podcastId, title: 'Fixture podcast', author: 'Host', description: 'A test podcast', category: 'Education', cover_url: art, published: true }],
    episodes: [1, 2, 3].map(n => ({ id: `44444444-4444-4444-8444-44444444444${n}`, podcast_id: podcastId, title: `Episode ${n}`, season_number: n === 3 ? 2 : 1, episode_number: n, audio_url: `http://127.0.0.1:3100/test-audio/episode${n}.wav?seconds=${seconds}`, duration: seconds, published: true })),
    profiles: [{ id: userId, display_name: 'Listener', username: 'listener', bio: '', avatar_url: '', role: 'user' }], playlists: [], soundverse_activity: []
  }
  await page.route(url => url.hostname === 'soundverse-test.supabase.co', async route => {
    const req = route.request(), url = new URL(req.url())
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(data) })
    if (req.method() === 'OPTIONS') return reply({})
    if (url.pathname.includes('/auth/v1/')) {
      if (url.pathname.endsWith('/logout')) return fail === 'logout' ? reply({ message: 'Logout failed' }, 500) : reply({})
      if (url.pathname.endsWith('/signup')) return reply({ user, session: null })
      if (url.pathname.endsWith('/user')) return reply(session.user)
      return reply(session)
    }
    const table = url.pathname.split('/').pop()
    if (fail === table) return reply({ message: `Fixture ${table} unavailable`, code: 'PGRST205' }, 503)
    if (!db[table]) return reply({ message: `Unknown fixture table ${table}` }, 404)
    let rows = db[table]
    const matches = row => [...url.searchParams].every(([key, val]) => !val.startsWith('eq.') || String(row[key]) === val.slice(3))
    if (req.method() === 'POST') {
      let input = req.postDataJSON(); input = Array.isArray(input) ? input : [input]
      if (table === 'soundverse_activity' && input.some(row => Object.keys(row).sort().join() !== Object.keys(input[0]).sort().join())) return reply({ message: 'All object keys must match', code: 'PGRST102' }, 400)
      if (table === 'profiles' && input.some(row => Object.keys(row).some(key => !['id','display_name','username','avatar_url','bio'].includes(key)))) return reply({ message: 'Profile contains a non-editable column', code: '42501' }, 403)
      rows = input.map(row => {
        const old = db[table].find(x => table === 'soundverse_activity' ? x.media_key === row.media_key && x.user_id === row.user_id : row.id && x.id === row.id)
        const next = { ...(old || { id: `55555555-5555-4555-8555-${String(db[table].length + 1).padStart(12, '0')}`, ...(table === 'playlists' ? { created_at: new Date().toISOString(), track_ids: [], revision: 0 } : {}) }), ...row }
        if (old) Object.assign(old, next); else db[table].push(next)
        return next
      })
    } else if (req.method() === 'PATCH') {
      rows = db[table].filter(matches); rows.forEach(row => Object.assign(row, req.postDataJSON()))
    } else if (req.method() === 'DELETE') {
      rows = db[table].filter(matches); db[table] = db[table].filter(row => !matches(row))
    } else {
      rows = rows.filter(matches)
      const offset = Number(url.searchParams.get('offset') || 0)
      const limit = Math.min(1000, Number(url.searchParams.get('limit') || 1000))
      rows = rows.slice(offset, offset + limit)
    }
    const single = req.headers().accept?.includes('vnd.pgrst.object')
    return reply(single ? rows[0] || null : rows)
  })
  await page.route('**/test-audio/**', route => {
    const body = wav(Number(new URL(route.request().url()).searchParams.get('seconds')) || 12)
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '')
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
    if (start >= body.length) return route.fulfill({ status: 416, headers: { 'content-range': `bytes */${body.length}` } })
    return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes', 'content-length': String(end - start + 1), ...(range ? { 'content-range': `bytes ${start}-${end}/${body.length}` } : {}) }, body: body.subarray(start, end + 1) })
  })
  await page.route(url => ['images.unsplash.com', 'i.pravatar.cc'].includes(url.hostname), route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#381f5d"/></svg>' }))
  await page.addInitScript(({ session, signedIn, player, preferences, userId }) => {
    if (!sessionStorage.getItem('fixture-initialized')) {
      sessionStorage.setItem('fixture-initialized','yes')
      if (signedIn) localStorage.setItem('sb-soundverse-test-auth-token', JSON.stringify(session))
      if (player) localStorage.setItem(`soundverse_player:${userId}`, JSON.stringify(player))
      if (preferences) localStorage.setItem('v2_playback_preferences', JSON.stringify(preferences))
    }
    window.testAudio = []; window.mediaEvents = []
    const NativeAudio = window.Audio
    window.Audio = function(...args) {
      const audio = new NativeAudio(...args); window.testAudio.push(audio)
      for (const event of ['playing','ended','pause','error']) audio.addEventListener(event, () => window.mediaEvents.push({ event, src: audio.src, time: audio.currentTime }))
      return audio
    }
    window.Audio.prototype = NativeAudio.prototype
  }, { session, signedIn, player, preferences, userId })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  return { db, catalog, podcastId, errors, session }
}
export const playerBar = page => page.locator('.v2-player-bar')
export async function playFirst(page) {
  await page.goto('/music')
  await page.locator('.v2-premium-card').filter({ hasText: 'Track 1' }).click()
  await expect(playerBar(page).getByTitle('Pause', { exact: true })).toBeVisible()
}
