import { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus } from '@discordjs/voice'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { access } from 'node:fs/promises'
import ffmpegPath from 'ffmpeg-static'
import { AudioTestError, safeTitle } from './music-source.js'

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
              headerTimer = setTimeout(() => { fail('HTTP/network timeout while opening the audio source (20 seconds).') }, 20_000)
              let response
              try { response = await fetch(source.url, { signal: controller.signal }) }
              catch { throw new AudioTestError('HTTP/network error while opening the audio source. Check connectivity, URL expiry, and access.') }
              clearTimeout(headerTimer)
              if (!response.ok) throw new AudioTestError(`Audio source inaccessible (HTTP ${response.status}). Check file access or URL expiry.`)
              if (!response.body) throw new AudioTestError('Audio source returned an empty response body.')
              if (/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) throw new AudioTestError('Audio source returned HTML/JSON instead of an audio file.')
              if (stopped || failed) { await response.body.cancel(); return }
              if (connection.state.status !== VoiceConnectionStatus.Ready) throw new AudioTestError('Voice connection is no longer Ready.')
              subscription = connection.subscribe(player)
              if (!subscription) throw new AudioTestError('Voice connection could not subscribe to the AudioPlayer.')
              // Fetch in Node: no sensitive URL in FFmpeg arguments or diagnostic output.
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
              input = Readable.fromWeb(response.body)
              // Detect stalled downloads after playback has started as well.
              let stallTimer
              const resetStall = () => {
                clearTimeout(stallTimer)
                stallTimer = setTimeout(() => {
                  // Pausing deliberately backpressures FFmpeg and the HTTP stream.
                  if (player.state.status === AudioPlayerStatus.Paused) resetStall()
                  else fail('Audio download stalled for 30 seconds.')
                }, 30_000)
              }
              input.on('data', resetStall)
              input.once('close', () => clearTimeout(stallTimer))
              input.once('end', () => clearTimeout(stallTimer))
              resetStall()
              void pipeline(input, decoder.stdin).catch((error) => {
                if (error.code !== 'EPIPE') fail('HTTP/network stream interrupted while downloading audio.')
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
