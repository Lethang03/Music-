// Read-only integration check: decode three seconds from the selected real track.
// No Discord login, audio broadcast, or database writes.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createAudioResource, StreamType } from '@discordjs/voice'
import ffmpegPath from 'ffmpeg-static'
import { firstMusicTrack, audioSource, safeTitle, AudioTestError } from '../discord-bot/music-source.js'

assert.throws(() => audioSource({ audio_url: 'blob:local-only' }), AudioTestError)
assert.throws(() => audioSource({ audio_url: 'https://user:password@example.com/audio' }), AudioTestError)
assert.equal(safeTitle('Track https://example.com/?token=secret\n'), 'Track [URL omitted] ')
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 45_000)
let decoder
let input
try {
  const source = await firstMusicTrack(controller.signal)
  console.log(`Music source: ${source.type} | Track: ${safeTitle(source.track.title)}`)
  const response = await fetch(source.url, { signal: controller.signal })
  if (!response.ok) throw new AudioTestError(`Audio HTTP ${response.status}`)
  assert.ok(response.body)
  decoder = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'pipe', '-i', 'pipe:0', '-t', '3', '-map', '0:a:0', '-vn', '-c:a', 'libopus', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-frame_duration', '20', '-f', 'ogg', 'pipe:1'], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
  const exited = new Promise((resolve, reject) => {
    decoder.once('error', () => reject(new AudioTestError('FFmpeg spawn failed.')))
    decoder.once('close', code => code === 0 ? resolve() : reject(new AudioTestError('FFmpeg decode failed.')))
  })
  // Attach the rejection handler immediately while the stream is consumed.
  void exited.catch(() => {})
  input = Readable.fromWeb(response.body)
  void pipeline(input, decoder.stdin).catch(() => {}) // Decoder intentionally stops at three seconds.
  const resource = createAudioResource(decoder.stdout, { inputType: StreamType.OggOpus })
  let packets = 0
  for await (const packet of resource.playStream) { assert.ok(packet.length); packets++ }
  await exited
  assert.ok(packets > 0)
  console.log(`PASS: published track accessible; FFmpeg -> Discord AudioResource produced ${packets} Opus packets.`)
} catch (error) {
  console.error(error instanceof AudioTestError ? error.message : 'Audio integration check failed (network, timeout, or resource error).')
  process.exitCode = 1
} finally {
  clearTimeout(timer)
  controller.abort()
  input?.destroy()
  decoder?.kill()
}
