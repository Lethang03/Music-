import { setTimeout as delay } from 'node:timers/promises'
import { setupAudioPlayback } from './audio.js'
import { getAllMusicTracks, audioSource, safeTitle, AudioTestError } from './music-source.js'
import { retryMusicLibrary } from './retry.js'

export function setupMusicQueue() {
  const audio = setupAudioPlayback()
  const state = { tracks: [], currentIndex: -1, currentTrack: null, isPlaying: false, isPaused: false, shuffle: false, repeatAll: true }
  let session, connection, requestedIndex, running = false
  let shuffleOrder = []

  const select = index => {
    state.currentIndex = index
    state.currentTrack = state.tracks[index] || null
  }
  const fillShuffle = () => {
    shuffleOrder = state.tracks.map((_, i) => i).filter(i => i !== state.currentIndex)
    for (let i = shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]]
    }
  }
  const nextIndex = () => state.shuffle ? (shuffleOrder.shift() ?? -1) : state.currentIndex + 1

  const run = async (controller, reload) => {
    const { signal } = controller
    let consecutiveFailures = 0
    try {
      if (reload || !state.tracks.length) {
        const tracks = await retryMusicLibrary(getAllMusicTracks, signal)
        if (signal.aborted) return
        state.tracks = tracks
        select(0)
      }
      if (state.shuffle) fillShuffle()
      while (!signal.aborted && state.tracks.length) {
        if (requestedIndex !== undefined) { select(requestedIndex); requestedIndex = undefined }
        const index = state.currentIndex
        const title = safeTitle(state.currentTrack?.title)
        let result
        try {
          const source = { track: state.currentTrack, ...audioSource(state.currentTrack) }
          result = await audio.play(source, connection, () => {
            if (signal.aborted) return
            state.isPlaying = true
            console.log(`[SOUNDVERSE] ▶ ${index + 1}/${state.tracks.length} - ${title} | Mode: ${state.repeatAll ? 'Repeat All' : 'Repeat One'}`)
          })
        } catch (error) {
          result = { status: 'failed', message: error instanceof AudioTestError ? error.message : 'Audio playback setup failed.' }
        }
        if (signal.aborted) return
        state.isPlaying = false
        state.isPaused = false
        // Manual navigation owns this transition, regardless of a simultaneous Idle.
        if (requestedIndex !== undefined) continue
        if (result.status === 'stopped') return
        if (result.status === 'finished') {
          consecutiveFailures = 0
          console.log(`[SOUNDVERSE] ✓ Finished - ${title}`)
          if (!state.repeatAll) continue
        } else {
          consecutiveFailures++
          console.error(`[SOUNDVERSE] ✗ Track failed - ${title} | ${result.message}`)
          if (consecutiveFailures >= state.tracks.length) {
            console.error('[SOUNDVERSE] Playback stopped: every track in this library cycle failed.')
            return
          }
          console.log('[SOUNDVERSE] → Skipping to next track')
          await delay(1000, undefined, { signal })
          if (signal.aborted) return
          if (requestedIndex !== undefined) continue
        }
        let next = nextIndex()
        if (next < 0 || next >= state.tracks.length) {
          console.log('[SOUNDVERSE] End of library\n[SOUNDVERSE] Refreshing Music Library...')
          try {
            const refreshed = await getAllMusicTracks(signal)
            if (signal.aborted) return
            state.tracks = refreshed
          } catch {
            if (signal.aborted) return
            console.warn('[SOUNDVERSE] Library refresh failed; retaining the previous library for the next cycle.')
          }
          if (requestedIndex !== undefined) requestedIndex = Math.min(requestedIndex, state.tracks.length - 1)
          next = 0
          if (state.shuffle && state.tracks.length) {
            const oldId = state.currentTrack?.id
            const candidates = state.tracks.map((_, i) => i).filter(i => state.tracks[i].id !== oldId)
            next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 0
          }
          select(next)
          if (state.shuffle) fillShuffle()
          if (state.tracks.length) console.log('[SOUNDVERSE] ↻ Starting new cycle')
        } else select(next)
      }
      if (!signal.aborted) console.warn('[SOUNDVERSE] Playback stopped: no playable music tracks.')
    } catch (error) {
      if (!signal.aborted) console.error(`[SOUNDVERSE] Library playback stopped: ${error instanceof AudioTestError ? error.message : 'Music library could not be loaded.'}`)
    } finally {
      if (session === controller) { running = false; state.isPlaying = false; state.isPaused = false }
    }
  }
  const launch = reload => {
    running = true
    session = new AbortController()
    void run(session, reload)
  }
  const navigate = direction => {
    if (!state.tracks.length || !running) return null
    let index
    if (direction < 0) index = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length
    else if (state.shuffle) {
      if (!shuffleOrder.length) fillShuffle()
      index = shuffleOrder.shift() ?? state.currentIndex
    } else index = (state.currentIndex + 1) % state.tracks.length
    requestedIndex = index
    select(index)
    state.isPaused = false
    state.isPlaying = false
    audio.stop() // Settles the old track once; Idle cannot advance the queue again.
    return state.currentTrack
  }

  return {
    get state() { return { ...state, tracks: [...state.tracks] } },
    start(voiceConnection) {
      if (session) return
      connection = voiceConnection
      launch(true)
    },
    play() {
      if (!connection) return 'disconnected'
      if (state.isPaused) {
        if (audio.resume()) { state.isPaused = false; state.isPlaying = true; return 'resumed' }
      }
      if (running) return state.isPlaying ? 'playing' : 'loading'
      if (state.currentIndex < 0 || state.currentIndex >= state.tracks.length) select(0)
      launch(false)
      return 'loading'
    },
    pause() {
      if (!audio.pause()) return false
      state.isPaused = true; state.isPlaying = false
      return true
    },
    resume() {
      if (!audio.resume()) return false
      state.isPaused = false; state.isPlaying = true
      return true
    },
    next() { return navigate(1) },
    previous() { return navigate(-1) },
    toggleShuffle() {
      state.shuffle = !state.shuffle
      if (state.shuffle) fillShuffle()
      else shuffleOrder = []
      return state.shuffle
    },
    toggleLoop() { state.repeatAll = !state.repeatAll; return state.repeatAll },
    upcoming() {
      if (!state.currentTrack) return []
      if (!state.repeatAll) return [state.currentTrack]
      if (state.shuffle) return shuffleOrder.slice(0, 5).map(i => state.tracks[i])
      return Array.from({ length: Math.min(5, state.tracks.length - 1) }, (_, i) => state.tracks[(state.currentIndex + i + 1) % state.tracks.length])
    },
    stop() {
      session?.abort()
      audio.stop()
      session = undefined; connection = undefined; requestedIndex = undefined; running = false
      state.isPlaying = false; state.isPaused = false; state.currentTrack = null
    },
  }
}
