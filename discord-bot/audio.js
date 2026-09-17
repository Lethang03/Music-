import { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus } from '@discordjs/voice'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import ffmpegPath from 'ffmpeg-static'
import { AudioTestError, safeTitle } from './music-source.js'
import { audioCache } from './cache.js'

export function setupAudioPlayback() {
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } })
  // A late error from a disposed resource must not crash an idle player.
  player.on('error', () => {})
  let cancelCurrent
  return {
    play(source, connection, onPlaying = () => {}) {
      if (cancelCurrent) throw new Error('An audio track is already active.')
      return new Promise((resolve) => {
        const controller = new AbortController()
        let stopped = false
        let failed = false
        let finished = false
        let playing = false
        let title = ''
        let decoder
        let input
        let subscription
        let startupTimer
        let headerTimer
        let exitCode
        let resource
        let decoderReason = 'FFmpeg decoding failed: unsupported, corrupt, or incomplete audio.'

        const cleanup = () => {
          clearTimeout(startupTimer)
          clearTimeout(headerTimer)
          controller.abort()
          input?.destroy()
          decoder?.stdin.destroy()
          decoder?.stdout.destroy()
          decoder?.kill()
          player.off('error', onError)
          player.off(AudioPlayerStatus.Playing, onStarted)
          player.off(AudioPlayerStatus.Idle, onIdle)
          player.stop(true)
          subscription?.unsubscribe()
          cancelCurrent = undefined
        }
        const fail = (message) => {
          if (stopped || failed || finished) return
          failed = true
          cleanup()
          resolve({ status: 'failed', message })
        }
        const finish = () => {
          if (stopped || failed || finished || !playing || exitCode !== 0 || player.state.status !== AudioPlayerStatus.Idle) return
          finished = true
          cleanup()
          resolve({ status: 'finished' })
        }
        const onError = (error) => {
          if (error.resource !== resource) return
          fail('AudioPlayer resource/stream error. Check audio encoding and source availability.')
        }
        const onStarted = (oldState, newState) => {
          if (newState.resource !== resource) return
          clearTimeout(startupTimer)
          if (playing || stopped || failed) return
          playing = true
          onPlaying()
        }
        const onIdle = (oldState) => {
          if (oldState.resource === resource) finish()
        }
        player.on('error', onError)
        player.on(AudioPlayerStatus.Playing, onStarted)
        player.on(AudioPlayerStatus.Idle, onIdle)
        cancelCurrent = () => {
          stopped = true
          cleanup()
          resolve({ status: 'stopped' })
        }

          const start = async () => {
            try {
              if (stopped) return
              title = safeTitle(source.track.title)
              console.log(`[SOUNDVERSE] Loading - ${title} | Source Type: ${source.type}`)
              if (!ffmpegPath) throw new AudioTestError('FFmpeg unavailable for this platform.')
              try { await access(ffmpegPath) } catch { throw new AudioTestError('FFmpeg unavailable: reinstall ffmpeg-static with its install script enabled.') }
              if (stopped) return
              // Check local cache before fetching from network
              let cachedFilePath = await audioCache.get(source)
              if (cachedFilePath) {
                console.log(`[SOUNDVERSE] Cache HIT - ${title} | Streaming from local cache`)
              } else {
                console.log(`[SOUNDVERSE] Cache MISS - ${title} | Downloading once to local cache`)
                headerTimer = setTimeout(() => { fail('HTTP/network timeout while opening the audio source (20 seconds).') }, 20_000)
                try {
                  cachedFilePath = await audioCache.downloadAndCache(source, controller.signal)
                } finally {
                  clearTimeout(headerTimer)
                }
                // Prune cache in background to prevent unlimited disk growth
                audioCache.prune().catch(() => {})
              }

              if (stopped || failed) return
              if (connection.state.status !== VoiceConnectionStatus.Ready) throw new AudioTestError('Voice connection is no longer Ready.')
              subscription = connection.subscribe(player)
              if (!subscription) throw new AudioTestError('Voice connection could not subscribe to the AudioPlayer.')
              // Decode in Node: no sensitive URL in FFmpeg arguments or diagnostic output.
              decoder = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'pipe', '-i', 'pipe:0', '-map', '0:a:0', '-vn', '-c:a', 'libopus', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-frame_duration', '20', '-f', 'ogg', 'pipe:1'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
              decoder.on('error', () => fail('FFmpeg could not start. Check binary installation and process execution permissions.'))
              decoder.stderr.on('data', (data) => {
                // Classify known errors, never forward raw FFmpeg stderr.
                const message = data.toString()
                if (/Unknown encoder|Encoder .* not found/i.test(message)) decoderReason = 'FFmpeg does not provide the libopus encoder.'
                else if (/matches no streams|does not contain any stream/i.test(message)) decoderReason = 'The selected source contains no audio stream.'
                else if (/Invalid data found/i.test(message)) decoderReason = 'FFmpeg rejected invalid or unsupported audio data.'
              })
              decoder.on('close', (code) => {
                exitCode = code
                if (code !== 0) fail(decoderReason)
                else finish()
              })
              startupTimer = setTimeout(() => fail('Audio did not start within 30 seconds. Source may be stalled or undecodable.'), 30_000)

              // Stream directly from cached file via stream pipeline without loading into RAM
              input = createReadStream(cachedFilePath)
              // Detect stalled playback
              let stallTimer
              const resetStall = () => {
                clearTimeout(stallTimer)
                stallTimer = setTimeout(() => {
                  // Pausing deliberately backpressures FFmpeg and the stream.
                  if (player.state.status === AudioPlayerStatus.Paused) resetStall()
                  else fail('Audio streaming stalled for 30 seconds.')
                }, 30_000)
              }
              input.on('data', resetStall)
              input.once('close', () => clearTimeout(stallTimer))
              input.once('end', () => clearTimeout(stallTimer))
              resetStall()
              void pipeline(input, decoder.stdin).catch((error) => {
                if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
                  fail('Audio stream interrupted while downloading or decoding.')
                }
              })
              try { resource = createAudioResource(decoder.stdout, { inputType: StreamType.OggOpus }) }
              catch { throw new AudioTestError('AudioResource creation failed for the decoded Opus stream.') }
              player.play(resource)
            } catch (error) {
              fail(error instanceof AudioTestError ? error.message : 'Unexpected audio setup failure; check music configuration and decoder installation.')
            }
          }
          void start()
      })
    },
    stop() { cancelCurrent?.() },
    pause() { return player.pause() },
    resume() { return player.unpause() },
  }
}

export { audioCache }
