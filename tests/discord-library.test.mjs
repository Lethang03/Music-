import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

test('full library pagination, official ordering, invalid sources, metadata, query failure', async () => {
  const rows = Array.from({ length: 53 }, (_, id) => ({ id, title: `Track ${id}`, audio_url: `https://example.invalid/${id}`, artist: 'Artist', duration: 123, cover_url: 'cover' }))
  rows[1].audio_url = ''
  rows[51].audio_url = 'blob:browser-only'
  const ranges = []
  let queryFailure = false
  mock.module('../src/lib/supabase.js', { namedExports: {
    supabaseReady: true,
    supabase: { from(table) {
      assert.equal(table, 'music_tracks')
      let start, end
      const orders = []
      return {
        select(fields) { assert.equal(fields, '*'); return this },
        eq(field, value) { assert.equal(field, 'published'); assert.equal(value, true); return this },
        order(...args) { orders.push(args); return this },
        range(a, b) { start = a; end = b; ranges.push([a, b]); return this },
        async abortSignal() {
          assert.deepEqual(orders, [['created_at', { ascending: false }], ['id']])
          return queryFailure ? { error: {}, status: 403 } : { data: rows.slice(start, end + 1) }
        },
      }
    } },
  } })
  const { getAllMusicTracks } = await import('../discord-bot/music-source.js')
  try {
    const tracks = await getAllMusicTracks(new AbortController().signal)
    assert.deepEqual(ranges, [[0, 49], [50, 99]])
    assert.equal(tracks.length, 51)
    assert.deepEqual(tracks.map(t => t.id), rows.filter(t => t.id !== 1 && t.id !== 51).map(t => t.id))
    assert.equal(tracks[0].artist, 'Artist'); assert.equal(tracks[0].duration, 123); assert.equal(tracks[0].cover_url, 'cover')
    queryFailure = true
    await assert.rejects(getAllMusicTracks(new AbortController().signal), /HTTP 403/)
  } finally { mock.restoreAll() }
})
