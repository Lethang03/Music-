import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { AudioTestError, audioSource, safeTitle } from '../discord-bot/music-source.js'
const track = id => ({ id, title: id, audio_url: `https://example.invalid/${id}.mp3` })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('radio: auto next, repeat, refresh, errors, deduplication and stop races', async () => {
  let catalog = [track('A'), track('B'), track('C')]
  let loads = 0, rejectRefresh = false, pendingLoad, active, factories = 0
  const plays = []
  mock.module('../discord-bot/music-source.js', { namedExports: {
    AudioTestError, audioSource, safeTitle,
    getAllMusicTracks: async () => {
      loads++
      if (rejectRefresh) throw new AudioTestError('test refresh failure')
      return pendingLoad || [...catalog]
    },
  } })
  mock.module('../discord-bot/audio.js', { namedExports: { setupAudioPlayback: () => {
    factories++
    return {
      play: (source, connection, onPlaying) => {
        assert.equal(active, undefined, 'overlapping audio')
        plays.push(source.track.id); onPlaying()
        return new Promise(resolve => { active = resolve })
      },
      stop: () => { const resolve = active; active = undefined; resolve?.({ status: 'stopped' }) },
    }
  } } })
  mock.module('node:timers/promises', { namedExports: { setTimeout: async (ms, value, { signal }) => {
    assert.equal(ms, 1000)
    if (signal.aborted) throw new Error('aborted')
  } } })
  const { setupMusicQueue } = await import('../discord-bot/queue.js')
  const finish = async (status = 'finished') => {
    assert.ok(active)
    const resolve = active; active = undefined
    resolve({ status, message: 'simulated failure' })
    resolve({ status, message: 'duplicate completion' })
    await tick()
  }
  let queue = setupMusicQueue()
  try {
    queue.start({}); queue.start({}); await tick()
    assert.deepEqual(plays, ['A']); assert.equal(loads, 1); assert.equal(factories, 1)
    assert.equal(queue.state.shuffle, false); assert.equal(queue.state.repeatAll, true)
    await finish(); assert.deepEqual(plays, ['A', 'B'])
    await finish(); assert.deepEqual(plays, ['A', 'B', 'C']); assert.equal(loads, 1)
    catalog.push(track('D'))
    await finish(); assert.equal(loads, 2); assert.equal(queue.state.tracks.length, 4)
    assert.deepEqual(plays, ['A', 'B', 'C', 'A'])
    await finish('failed'); assert.equal(plays.at(-1), 'B')
    await finish(); await finish(); assert.equal(plays.at(-1), 'D')
    rejectRefresh = true
    await finish(); assert.equal(plays.at(-1), 'A'); assert.equal(queue.state.tracks.length, 4)
    queue.stop(); await tick(); assert.equal(active, undefined)
    rejectRefresh = false; loads = 0; plays.length = 0; catalog = [track('X'), track('Y')]
    queue = setupMusicQueue(); queue.start({}); await tick()
    await finish('failed'); await finish('failed')
    assert.deepEqual(plays, ['X', 'Y']); assert.equal(loads, 1); assert.equal(active, undefined)
    queue.start({}); await tick(); assert.equal(loads, 1); queue.stop()
    catalog = []; plays.length = 0
    queue = setupMusicQueue(); queue.start({}); await tick()
    assert.deepEqual(plays, []); queue.stop()
    let releaseOld
    pendingLoad = new Promise(resolve => { releaseOld = resolve })
    queue = setupMusicQueue(); queue.start({}); queue.stop()
    pendingLoad = undefined; catalog = [track('new-session')]
    queue.start({}); await tick()
    releaseOld([track('stale-session')]); await tick()
    assert.deepEqual(plays, ['new-session'])
    assert.equal(queue.state.currentTrack.id, 'new-session')
  } finally { queue.stop(); mock.restoreAll() }
})
