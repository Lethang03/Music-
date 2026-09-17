import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createAudioResource, StreamType, AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior } from '@discordjs/voice'

test('real FFmpeg: sequential tracks, duplicate/stale events, HTTP failure, stop', async () => {
  let plays = 0, starts = 0, previousResource
  const player = new EventEmitter()
  player.state = { status: AudioPlayerStatus.Idle }
  player.stop = () => {
    const old = player.state
    player.state = { status: AudioPlayerStatus.Idle }
    player.emit(AudioPlayerStatus.Idle, old, player.state)
  }
  player.play = resource => {
    plays++
    const previous = previousResource
    previousResource = resource
    void (async () => {
      try {
        for await (const packet of resource.playStream) {
          assert.ok(packet.length)
          if (player.state.resource !== resource) {
            const old = player.state
            player.state = { status: AudioPlayerStatus.Playing, resource }
            player.emit(AudioPlayerStatus.Playing, old, player.state)
            if (previous) {
              player.emit(AudioPlayerStatus.Idle, { resource: previous }, { status: AudioPlayerStatus.Idle })
              player.emit('error', { resource: previous })
            }
          }
        }
        player.stop()
        player.emit(AudioPlayerStatus.Idle, { resource }, player.state)
      } catch { player.emit('error', { resource }) }
    })()
  }
  mock.module('@discordjs/voice', { namedExports: {
    createAudioResource, StreamType, AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior,
    createAudioPlayer: () => player,
  } })
  const { setupAudioPlayback, audioCache } = await import('../discord-bot/audio.js')
  await audioCache?.clear()
  const wav = Buffer.alloc(44 + 4800 * 2)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(wav))
  const connection = { state: { status: VoiceConnectionStatus.Ready }, subscribe: () => ({ unsubscribe() {} }) }
  const source = { track: { title: 'Fixture' }, url: 'https://example.invalid/audio?token=DO_NOT_LOG', type: 'External' }
  const audio = setupAudioPlayback()
  try {
    for (let i = 0; i < 3; i++) {
      const pending = audio.play(source, connection, () => starts++)
      assert.throws(() => audio.play(source, connection), /already active/)
      assert.equal((await pending).status, 'finished')
    }
    assert.equal(plays, 3); assert.equal(starts, 3)
    fetchMock.mock.mockImplementation(async () => new Response(null, { status: 403 }))
    await audioCache?.clear()
    const failure = await audio.play(source, connection)
    assert.equal(failure.status, 'failed'); assert.match(failure.message, /HTTP 403/)
    assert.ok(!failure.message.includes('DO_NOT_LOG'))
    const pending = audio.play(source, connection)
    audio.stop()
    assert.equal((await pending).status, 'stopped')
    assert.equal(plays, 3)
  } finally { audio.stop(); await audioCache?.clear(); mock.restoreAll() }
})
