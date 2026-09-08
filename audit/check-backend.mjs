import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => {
  const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]
}))
try {
  const schemaResponse = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(10000) })
  const schema = await schemaResponse.json()
  for (const name of ['playlists', 'favorites', 'profiles']) console.log('Schema', name, schema.definitions?.[name]?.properties || 'Not exposed')
  for (const table of ['music_tracks', 'podcasts', 'episodes', 'profiles', 'playlists', 'soundverse_activity', 'playlist_tracks', 'favorites', 'history', 'settings']) {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(10000)
    })
    const data = await response.json()
    console.log(table, response.status, response.ok ? { sampleRows: data.length, columns: Object.keys(data[0] || {}) } : { code: data.code, message: data.message })
  }
} catch (error) { console.log('Connection failed:', error.message, error.cause?.code || '') }
