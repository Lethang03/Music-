import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { AudioTestError, audioSource, safeTitle } from '../discord-bot/music-source.js'
const tick = () => new Promise(resolve => setImmediate(resolve))

test('controls: next once, previous wrap, pause/resume, repeat one and shuffle preview', async () => {
  const tracks = ['A', 'B', 'C'].map(id => ({ id, title: id, audio_url: `https://example.invalid/${id}` }))
  let active, paused = false, loads = 0
  const played = []
  mock.module('../discord-bot/music-source.js', { namedExports: {
    AudioTestError, audioSource, safeTitle, getAllMusicTracks: async () => { loads++; return [...tracks] },
  } })
  mock.module('../discord-bot/audio.js', { namedExports: { setupAudioPlayback: () => ({
    play(source, connection, onPlaying) {
      assert.equal(active, undefined)
      played.push(source.track.id); paused = false; onPlaying()
      return new Promise(resolve => { active = resolve })
    },
    stop() { const resolve = active; active = undefined; paused = false; resolve?.({ status: 'stopped' }) },
    pause() { if (!active || paused) return false; paused = true; return true },
    resume() { if (!active || !paused) return false; paused = false; return true },
  }) } })
  const { setupMusicQueue } = await import('../discord-bot/queue.js')
  const queue = setupMusicQueue()
  const finish = async () => {
    const resolve = active; active = undefined
    resolve({ status: 'finished' }); resolve({ status: 'finished' })
    await tick()
  }
  try {
    queue.start({}); await tick()
    assert.equal(queue.play(), 'playing'); assert.deepEqual(played, ['A'])
    assert.equal(queue.pause(), true); assert.equal(queue.state.isPaused, true)
    const samePlayback = active
    assert.equal(queue.play(), 'resumed'); assert.equal(active, samePlayback)
    assert.equal(queue.pause(), true); assert.equal(queue.resume(), true)
    const oldCompletion = active
    assert.equal(queue.next().id, 'B')
    oldCompletion({ status: 'finished' }); await tick()
    assert.deepEqual(played, ['A', 'B']); assert.equal(queue.state.currentIndex, 1)
    assert.equal(queue.previous().id, 'A'); await tick()
    assert.equal(queue.previous().id, 'C'); await tick()
    assert.equal(queue.toggleLoop(), false)
    await finish(); assert.equal(played.at(-1), 'C'); assert.equal(loads, 1)
    assert.equal(queue.next().id, 'A'); await tick() // Manual next ignores Repeat One.
    queue.toggleLoop()
    assert.equal(queue.toggleShuffle(), true)
    const preview = queue.upcoming().map(track => track.id)
    assert.equal(preview.length, 2); assert.ok(!preview.includes('A'))
    assert.equal(queue.next().id, preview[0]); await tick()
    assert.deepEqual(queue.state.tracks.map(track => track.id), ['A', 'B', 'C'])
    const current = queue.state.currentIndex
    assert.equal(queue.toggleShuffle(), false)
    assert.equal(queue.next().id, tracks[(current + 1) % 3].id); await tick()
    // Two distinct requests move twice, but duplicate completion still moves zero extra.
    const before = queue.state.currentIndex
    queue.next(); queue.next(); await tick()
    assert.equal(queue.state.currentIndex, (before + 2) % 3)
    assert.equal(loads, 1)
  } finally { queue.stop(); mock.restoreAll() }
})
