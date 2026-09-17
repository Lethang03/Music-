import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { readStored, writeStored, mediaKey, mediaUrl, validUrl } from '../lib/storage'
import { logPlaybackEvent } from '../lib/playbackDiagnostics'
import { mediaProvider } from '../services/media'
import { recordAudioRequest } from '../lib/audioNetworkLogger'

const AudioCtx = createContext(null)
const clampVolume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 1
const sessionState = value => {
  try { if (navigator.mediaSession) navigator.mediaSession.playbackState = value } catch { /* Optional API. */ }
}
function safeSetPositionState(duration, position = 0, playbackRate = 1) {
  if (!('mediaSession' in navigator) || typeof navigator.mediaSession?.setPositionState !== 'function') return
  const d = Number(duration)
  const pos = Math.max(0, Number(position) || 0)
  if (!Number.isFinite(d) || d <= 0) return
  if (!Number.isFinite(pos)) return
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: Math.max(0.1, Number(playbackRate) || 1),
      position: Math.min(pos, d)
    })
  } catch {
    /* Optional API on platforms where setPositionState is missing or throws */
  }
}
const sessionMetadata = item => {
  if (!navigator.mediaSession) return
  const fields = { title: item?.title || '', artist: item?.artist || item?.author || '' }
  const artwork = mediaProvider.getArtworkUrl(item?.image_url || item?.cover_url || item?.image)
  try {
    navigator.mediaSession.metadata = item ? new MediaMetadata({ ...fields, artwork: artwork ? [{ src: artwork }] : [] }) : null
  } catch {
    try { navigator.mediaSession.metadata = item ? new MediaMetadata(fields) : null } catch { /* Optional API. */ }
  }
  if (!item) sessionState('none')
}
export const EQ_PRESETS = {
  Default: { bass: 0, mid: 0, treble: 0 },
  'Bass Boost': { bass: 6, mid: 0, treble: -1 },
  Vocal: { bass: -2, mid: 5, treble: 2 },
  Acoustic: { bass: 2, mid: 1, treble: 3 },
  Pop: { bass: 4, mid: 2, treble: 4 },
  Rock: { bass: 5, mid: -1, treble: 4 },
  Electronic: { bass: 7, mid: 1, treble: 6 },
  Night: { bass: -4, mid: 1, treble: -5 }
}

const initialEq = () => {
  const saved = readStored('v2_equalizer_settings', {})
  const enabled = saved?.enabled === true
  const preset = typeof saved?.preset === 'string' && (EQ_PRESETS[saved.preset] || saved.preset === 'Custom') ? saved.preset : 'Default'
  const fallbackValues = EQ_PRESETS[preset] || EQ_PRESETS.Default
  const values = {
    bass: Number.isFinite(Number(saved?.values?.bass)) ? Math.max(-12, Math.min(12, Number(saved.values.bass))) : fallbackValues.bass,
    mid: Number.isFinite(Number(saved?.values?.mid)) ? Math.max(-12, Math.min(12, Number(saved.values.mid))) : fallbackValues.mid,
    treble: Number.isFinite(Number(saved?.values?.treble)) ? Math.max(-12, Math.min(12, Number(saved.values.treble))) : fallbackValues.treble
  }
  return { eqEnabled: enabled, eqPreset: preset, eqValues: values }
}

const initialPrefs = () => {
  const saved = readStored('v2_playback_preferences', {})
  return { volume: clampVolume(saved?.volume ?? readStored('v2_volume', 1)), shuffle: saved?.shuffle === true, repeat: ['none','one','all'].includes(saved?.repeat) ? saved.repeat : 'none', autoplay: saved?.autoplay !== false }
}

function getOrCreateAudioInstance(existing) {
  if (existing) return existing
  if (typeof window !== 'undefined' && window.__soundverse_audio_instance) {
    return window.__soundverse_audio_instance
  }
  const audio = new Audio()
  if (typeof window !== 'undefined') {
    window.__soundverse_audio_instance = audio
  }
  return audio
}

// Commands synchronously update one model. Media events never depend on React render timing.
export function AudioProvider({ children, storageKey = 'v2_player_state', onProgress, getResumeTime }) {
  const audioRef = useRef(null)
  const webAudioRef = useRef({ ctx: null, source: null, bass: null, mid: null, treble: null, initialized: false })
  const [state, setState] = useState(() => ({ queue: [], index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '', ...initialPrefs(), ...initialEq() }))
  const model = useRef(state)
  const generation = useRef(0)
  const pendingSeek = useRef(0)
  const retryCount = useRef(0)
  const visited = useRef(new Set())
  const callbacks = useRef({ onProgress, getResumeTime })
  callbacks.current = { onProgress, getResumeTime }
  const lastSaved = useRef(0)
  const cleared = useRef(false)
  const stopping = useRef(false)
  const publish = useCallback(patch => {
    model.current = { ...model.current, ...patch }
    if (Object.prototype.hasOwnProperty.call(patch, 'activeItem')) sessionMetadata(patch.activeItem)
    setState(model.current)
  }, [])
  const persist = useCallback(() => {
    if (cleared.current) return
    const { queue, index, currentTime } = model.current
    // Prefer the media element over React state: pagehide and pause can occur
    // between timeupdate events. A pending restore must win until metadata has
    // made that seek safe to apply.
    const liveTime = audioRef.current?.readyState ? audioRef.current.currentTime : currentTime
    writeStored(storageKey, { queue, index, currentTime: pendingSeek.current || liveTime || 0 })
    const { volume, shuffle, repeat, autoplay } = model.current
    writeStored('v2_playback_preferences', { volume, shuffle, repeat, autoplay })
    writeStored('v2_volume', volume)
  }, [storageKey])
  const report = useCallback((done = false, elapsed = 0) => {
    const s = model.current
    if (!audioRef.current?.readyState || pendingSeek.current) return
    if (s.activeItem) callbacks.current.onProgress?.(s.activeItem, audioRef.current?.currentTime || 0, audioRef.current?.duration || 0, done, elapsed)
  }, [])
  const diagnostic = useCallback((event, audio = audioRef.current, item = model.current.activeItem, detail = '') => logPlaybackEvent(event, audio, item, detail), [])
  const applyEqGains = useCallback((values, enabled) => {
    const { initialized, ctx, bass, mid, treble } = webAudioRef.current
    if (!initialized || !ctx || !bass || !mid || !treble) return
    const now = ctx.currentTime
    const b = enabled ? Number(values?.bass ?? 0) : 0
    const m = enabled ? Number(values?.mid ?? 0) : 0
    const t = enabled ? Number(values?.treble ?? 0) : 0
    try {
      bass.gain.setValueAtTime(b, now)
      mid.gain.setValueAtTime(m, now)
      treble.gain.setValueAtTime(t, now)
    } catch {
      /* AudioContext may be transitioning */
    }
  }, [])
  const initEqualizer = useCallback(() => {
    if (webAudioRef.current.initialized) {
      if (webAudioRef.current.ctx?.state === 'suspended') {
        webAudioRef.current.ctx.resume().catch(() => {})
      }
      return true
    }
    const audio = audioRef.current
    if (!audio) return false
    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
    if (!AudioContextClass) return false

    try {
      const ctx = new AudioContextClass()
      const source = ctx.createMediaElementSource(audio)

      const bass = ctx.createBiquadFilter()
      bass.type = 'lowshelf'
      bass.frequency.value = 120

      const mid = ctx.createBiquadFilter()
      mid.type = 'peaking'
      mid.frequency.value = 1000
      mid.Q.value = 1.0

      const treble = ctx.createBiquadFilter()
      treble.type = 'highshelf'
      treble.frequency.value = 8000

      source.connect(bass)
      bass.connect(mid)
      mid.connect(treble)
      treble.connect(ctx.destination)

      webAudioRef.current = { ctx, source, bass, mid, treble, initialized: true }

      const s = model.current
      applyEqGains(s.eqValues, s.eqEnabled)

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      return true
    } catch (err) {
      diagnostic('ERROR', audio, model.current.activeItem, `Web Audio EQ initialization failed: ${err?.message || err}`)
      return false
    }
  }, [applyEqGains, diagnostic])
  const loadRef = useRef(null)
  const safePlay = useCallback(async (reason = 'PLAY_REQUEST') => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src && model.current.activeItem) {
      return loadRef.current?.(model.current.index, true, pendingSeek.current || model.current.currentTime, reason)
    }
    if (!audio.src) return
    if (audio.preload !== 'metadata') audio.preload = 'metadata'
    const token = generation.current
    const item = model.current.activeItem
    diagnostic(reason, audio)
    publish({ error: '' })
    if (webAudioRef.current.initialized && webAudioRef.current.ctx?.state === 'suspended') {
      webAudioRef.current.ctx.resume().catch(() => {})
    } else if (model.current.eqEnabled && !webAudioRef.current.initialized) {
      initEqualizer()
    }
    try {
      await audio.play()
      if (token === generation.current) diagnostic('PLAY_SUCCESS', audio)
      return true
    } catch (error) {
      diagnostic('PLAY_REJECTED', audio, item, error?.name || 'Error')
      if (token !== generation.current) return false
      const message = error?.name === 'NotAllowedError'
        ? 'Playback was blocked. Press Play to try again.'
        : error?.name === 'AbortError'
          ? 'Playback was interrupted while switching tracks. Press Play to try again.'
          : `Unable to play this audio: ${error?.message || 'unknown media error'}`
      sessionState('paused')
      publish({ isPlaying: false, error: message })
      return false
    }
  }, [diagnostic, publish])
  const load = useCallback(async (index, play = true, resume, reason = 'SOURCE_CHANGED') => {
    const audio = audioRef.current
    const item = model.current.queue[index]
    if (!audio || !item) return
    cleared.current = false
    if (item._playNext) publish({ queue: model.current.queue.map((entry, i) => i === index ? { ...entry, _playNext: false } : entry) })
    report()
    generation.current++
    const source = mediaUrl(item)
    const url = item?.type === 'episode' || item?.podcast_id
      ? mediaProvider.getPodcastAudioUrl(source)
      : mediaProvider.getAudioUrl(source)
    if (!url || !validUrl(url)) {
      audio.removeAttribute('src'); audio.load()
      pendingSeek.current = 0
      publish({ index, activeItem: item, currentTime: 0, duration: 0, isPlaying: false })
      sessionState('none')
      diagnostic('ERROR', audio, item, 'Item has no playable audio URL')
      publish({ error: 'This item has no playable audio URL. Choose another item.' })
      return
    }
    pendingSeek.current = Math.max(0, resume ?? callbacks.current.getResumeTime?.(item) ?? 0)

    // Task 3: Fix duplicate audio request via mediaKey(activeTrack) === mediaKey(requestTrack)
    const activeItem = model.current.activeItem
    const isSameTrack = activeItem && mediaKey(activeItem) === mediaKey(item)
    const cleanAudioSrc = (audio.src || '').split('?')[0]
    const cleanUrl = url.split('?')[0]
    const isSameUrl = cleanAudioSrc === cleanUrl || (audio.src && url && audio.src === new URL(url, window.location.href).href)

    if ((isSameTrack || isSameUrl) && audio.src) {
      if (resume !== undefined && Number.isFinite(resume) && audio.readyState >= 1) {
        audio.currentTime = resume
      }
      publish({ index, activeItem: item, currentTime: audio.currentTime || 0, duration: audio.duration || Number(item.duration) || 0, error: '' })
      sessionState(play ? 'playing' : 'paused')
      if (play) {
        audio.preload = 'metadata'
        await safePlay('PLAY_REQUEST')
      }
      persist()
      return
    }

    // Task 4: Queue restore - load metadata only, do not connect audio for unplayed track
    if (!play && (!pendingSeek.current || pendingSeek.current <= 0)) {
      audio.preload = 'none'
      publish({
        index,
        activeItem: item,
        currentTime: 0,
        duration: Number(item.duration) || 0,
        isPlaying: false,
        error: ''
      })
      sessionState('paused')
      persist()
      return
    }

    if (!play) {
      audio.preload = 'metadata'
      audio.src = url
      audio.load()
      publish({ index, activeItem: item, currentTime: pendingSeek.current || 0, duration: Number(item.duration) || 0, isPlaying: false, error: '' })
      sessionState('paused')
      persist()
      return
    }

    // Task 1 & 2: Explicit user play - preload metadata only, load stream on play
    retryCount.current = 0
    recordAudioRequest({ url, title: item.title, initiator: reason })
    audio.preload = 'metadata'
    audio.src = url
    audio.load()
    publish({ index, activeItem: item, currentTime: 0, duration: 0, isPlaying: false, error: '' })
    // Preserve the session while buffering; play is issued before React renders.
    sessionState('playing')
    diagnostic('SOURCE_CHANGED', audio, item, reason)
    if (play) await safePlay('PLAY_REQUEST')
    persist()
  }, [diagnostic, persist, publish, report, safePlay])
  loadRef.current = load
  const handleNext = useCallback(async (auto = false) => {
    const s = model.current
    if (!s.queue.length) return
    diagnostic(auto ? 'ENDED' : 'MANUAL_NEXT')
    if (auto && s.repeat === 'one') { diagnostic('NEXT_SELECTED', audioRef.current, s.queue[s.index], 'repeat-one'); await load(s.index, true, 0, 'repeat-one'); return }
    if (auto && !s.autoplay) { sessionState('paused'); publish({ isPlaying: false }); persist(); return }
    const priority = s.queue.findIndex((item, index) => index !== s.index && item._playNext)
    let next = priority >= 0 ? priority : s.index + 1
    if (priority < 0 && s.shuffle && s.queue.length > 1) {
      visited.current.add(s.index)
      let choices = s.queue.map((_, i) => i).filter(i => !visited.current.has(i))
      if (!choices.length && s.repeat === 'all') {
        visited.current = new Set([s.index])
        choices = s.queue.map((_, i) => i).filter(i => i !== s.index)
      }
      next = choices.length ? choices[Math.floor(Math.random() * choices.length)] : s.queue.length
    }
    if (next >= s.queue.length && s.repeat === 'all') next = 0
    if (next < s.queue.length) { diagnostic('NEXT_SELECTED', audioRef.current, s.queue[next], auto ? 'ended' : 'manual'); await load(next, true, 0, auto ? 'ended' : 'manual-next') }
    else { audioRef.current?.pause(); sessionState('paused'); publish({ isPlaying: false }); persist() }
  }, [diagnostic, load, persist, publish])
  const handlePrev = useCallback((play = false) => {
    const s = model.current
    if ((audioRef.current?.currentTime || 0) > 3 || s.index === 0) {
      if (audioRef.current) audioRef.current.currentTime = 0
      pendingSeek.current = 0
      publish({ currentTime: 0 })
      if (play === true) void safePlay('PLAY_REQUEST')
    } else load(s.index - 1, true, 0)
  }, [load, publish, safePlay])
  useEffect(() => {
    // Keep one media instance under the provider's ownership. Besides avoiding
    // a rendered element being replaced outside the player lifecycle, this is
    // the instance exposed by window.Audio in the Playwright media fixture.
    const audio = getOrCreateAudioInstance(audioRef.current)
    audioRef.current = audio
    audio.preload = 'none'
    audio.volume = clampVolume(model.current.volume)
    let lastTick = performance.now()
    const handlers = {
      timeupdate: () => {
        const now = performance.now()
        const elapsed = !audio.paused && !audio.seeking ? Math.min((now - lastTick) / 1000, 2) : 0
        lastTick = now
        publish({ currentTime: audio.currentTime })
        report(false, elapsed)
        if (Date.now() - lastSaved.current > 5000) { persist(); lastSaved.current = Date.now() }
      },
      loadedmetadata: () => {
        diagnostic('LOADEDMETADATA', audio)
        // currentTime is only seekable after metadata exists. Keep the pending
        // value until this event so a refresh cannot discard a podcast offset.
        const savedPosition = pendingSeek.current
        if (savedPosition > 0) {
          const maxPosition = Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.max(0, audio.duration - 0.1)
            : savedPosition
          audio.currentTime = Math.min(savedPosition, maxPosition)
        }
        pendingSeek.current = 0
        publish({ duration: Number.isFinite(audio.duration) ? audio.duration : 0, currentTime: audio.currentTime })
        safeSetPositionState(audio.duration, audio.currentTime, audio.playbackRate)
      },
      durationchange: () => publish({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }),
      canplay: () => diagnostic('CANPLAY', audio),
      playing: () => { if (audio.paused) return; diagnostic('PLAYING', audio); lastTick = performance.now(); publish({ isPlaying: true, error: '' }); sessionState('playing'); },
      pause: () => {
        if (!audio.paused) return
        diagnostic('PAUSE', audio)
        publish({ isPlaying: false })
        report()
        persist()
        if (stopping.current) {
          stopping.current = false
          sessionState('none')
        } else {
          sessionState(model.current.activeItem ? 'paused' : 'none')
        }
      },
      waiting: () => diagnostic('WAITING', audio),
      stalled: () => diagnostic('STALLED', audio),
      ended: () => { if (!audio.ended) return; diagnostic('ENDED', audio); report(true); void handleNext(true); },
      error: () => { diagnostic('ERROR', audio); publish({ isPlaying: false, error: 'Audio could not be loaded. Check your connection or choose another item.' }); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; }
    }
    Object.entries(handlers).forEach(([event, handler]) => audio.addEventListener(event, handler))
    const saved = readStored(storageKey, null)
    const queue = Array.isArray(saved?.queue) ? saved.queue.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && mediaUrl(item)).slice(0, 1000) : []
    publish({ queue, index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '' })
    if (queue.length) load(Math.max(0, Math.min(queue.length - 1, Number.isInteger(saved.index) ? saved.index : 0)), false, Number.isFinite(saved.currentTime) ? saved.currentTime : 0)
    const flush = () => { report(); persist() }
    
    const hardStop = () => {
      audio.pause()
      audio.src = ''
      audio.removeAttribute('src')
      audio.load()
    }
    
    window.addEventListener('pagehide', flush)
    const visibility = () => diagnostic(document.visibilityState === 'hidden' ? 'VISIBILITY_HIDDEN' : 'VISIBILITY_VISIBLE', audio)
    document.addEventListener('visibilitychange', visibility)
    const clearPlayer = () => {
      report()
      cleared.current = true
      generation.current++
      pendingSeek.current = 0
      visited.current.clear()
      publish({ queue: [], index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '' })
      hardStop()
      try {
        localStorage.removeItem(storageKey)
        localStorage.removeItem('v2_playback_preferences')
        localStorage.removeItem('v2_volume')
      } catch { /* Storage restrictions must never prevent logout. */ }
    }
    window.addEventListener('auth_signout', clearPlayer)
    window.addEventListener('auth_cleared', clearPlayer)
    
    return () => {
      flush()
      generation.current++
      Object.entries(handlers).forEach(([event, handler]) => audio.removeEventListener(event, handler))
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('auth_signout', clearPlayer)
      window.removeEventListener('auth_cleared', clearPlayer)
      // Keep instance intact across HMR and route changes
    }
  }, [storageKey, diagnostic, handleNext, load, persist, publish, report])
  const seek = useCallback(time => {
    const audio = audioRef.current
    if (audio && Number.isFinite(time)) {
      pendingSeek.current = Math.max(0, time)
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.readyState >= 1) {
        audio.currentTime = Math.max(0, Math.min(time, audio.duration))
      }
      publish({ currentTime: time })
      report()
      persist()
      safeSetPositionState(model.current.duration || audio.duration, time, audio.playbackRate)
    }
  }, [persist, publish, report])
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.src && model.current.activeItem) {
      void load(model.current.index, true, pendingSeek.current || model.current.currentTime, 'play-deferred')
      return
    }
    if (audio.paused) void safePlay('PLAY_REQUEST')
    else audio.pause()
  }, [load, safePlay])
  const playItem = useCallback((item, newQueue = null, index = 0, resume) => {
    if (!item) return
    const queue = newQueue?.length ? newQueue : [item]
    const matching = queue[index] && mediaKey(queue[index]) === mediaKey(item) ? index : queue.findIndex(x => mediaKey(x) === mediaKey(item))
    if (matching < 0) { publish({ error: 'The selected item is not in this queue.' }); return }
    visited.current = new Set()
    publish({ queue })
    void load(matching, true, resume, 'play-item')
  }, [load, publish])
  const setPreference = (key, value) => {
    const next = typeof value === 'function' ? value(model.current[key]) : value
    publish({ [key]: next }); persist()
  }
  const setVolume = value => {
    const volume = clampVolume(value)
    if (audioRef.current) audioRef.current.volume = volume
    setPreference('volume', volume)
  }
  const setShuffle = value => { visited.current = new Set(); setPreference('shuffle', value) }
  const setRepeat = value => setPreference('repeat', value)
  const addToQueue = (item, next = false) => {
    if (!item) return
    const s = model.current
    const queue = [...s.queue]
    queue.splice(next ? s.index + 1 : queue.length, 0, next ? { ...item, _playNext: true } : item)
    visited.current = new Set()
    publish({ queue }); persist()
    if (!s.activeItem) void load(0, false, 0, 'queue-initial')
  }
  const removeFromQueue = index => {
    const s = model.current
    if (index < 0 || index >= s.queue.length) return
    const queue = s.queue.filter((_, i) => i !== index)
    visited.current = new Set()
    if (!queue.length) {
      report(); generation.current++; audioRef.current?.pause()
      audioRef.current?.removeAttribute('src'); audioRef.current?.load()
      publish({ queue, index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0 })
    } else {
      publish({ queue, index: index < s.index ? s.index - 1 : Math.min(s.index, queue.length - 1) })
      if (index === s.index) void load(model.current.index, s.isPlaying, 0, 'queue-removal')
    }
    persist()
  }
  const reorderQueue = (source, target) => {
    const s = model.current
    if (source < 0 || source >= s.queue.length || target < 0 || target >= s.queue.length || source === target) return
    const queue = [...s.queue]
    const item = queue.splice(source, 1)[0]
    queue.splice(target, 0, item)
    visited.current = new Set()
    const active = s.queue[s.index]
    const newIndex = queue.findIndex(x => x === active)
    publish({ queue, index: Math.max(0, newIndex) })
    persist()
  }
  const persistEq = useCallback((enabled, preset, values) => {
    writeStored('v2_equalizer_settings', { enabled, preset, values })
  }, [])
  const setEqEnabled = useCallback(value => {
    const next = typeof value === 'function' ? value(model.current.eqEnabled) : Boolean(value)
    if (next && !webAudioRef.current.initialized) {
      initEqualizer()
    }
    publish({ eqEnabled: next })
    applyEqGains(model.current.eqValues, next)
    persistEq(next, model.current.eqPreset, model.current.eqValues)
  }, [initEqualizer, applyEqGains, persistEq, publish])
  const setEqPreset = useCallback(presetName => {
    const presetValues = EQ_PRESETS[presetName]
    if (!presetValues) return
    if (!webAudioRef.current.initialized && model.current.eqEnabled) {
      initEqualizer()
    }
    const nextValues = { ...presetValues }
    publish({ eqPreset: presetName, eqValues: nextValues })
    applyEqGains(nextValues, model.current.eqEnabled)
    persistEq(model.current.eqEnabled, presetName, nextValues)
  }, [initEqualizer, applyEqGains, persistEq, publish])
  const setEqBand = useCallback((band, rawValue) => {
    if (!['bass', 'mid', 'treble'].includes(band)) return
    const val = Math.max(-12, Math.min(12, Math.round(Number(rawValue) || 0)))
    const nextValues = { ...model.current.eqValues, [band]: val }
    const matchedPreset = Object.entries(EQ_PRESETS).find(([_, p]) => p.bass === nextValues.bass && p.mid === nextValues.mid && p.treble === nextValues.treble)
    const nextPreset = matchedPreset ? matchedPreset[0] : 'Custom'
    if (!webAudioRef.current.initialized && model.current.eqEnabled) {
      initEqualizer()
    }
    publish({ eqPreset: nextPreset, eqValues: nextValues })
    applyEqGains(nextValues, model.current.eqEnabled)
    persistEq(model.current.eqEnabled, nextPreset, nextValues)
  }, [initEqualizer, applyEqGains, persistEq, publish])
  const resetEq = useCallback(() => {
    const flatValues = { ...EQ_PRESETS.Default }
    if (!webAudioRef.current.initialized && model.current.eqEnabled) {
      initEqualizer()
    }
    publish({ eqPreset: 'Default', eqValues: flatValues })
    applyEqGains(flatValues, model.current.eqEnabled)
    persistEq(model.current.eqEnabled, 'Default', flatValues)
  }, [initEqualizer, applyEqGains, persistEq, publish])
  useEffect(() => {
    if (!navigator.mediaSession) return
    // Handlers belong to the provider lifetime, not to a React track render.
    const action = (name, command) => detail => {
      diagnostic('MEDIA_SESSION', audioRef.current, model.current.activeItem, name)
      return command(detail)
    }
    const actions = {
      play: action('play', () => safePlay('PLAY_REQUEST')),
      pause: action('pause', () => audioRef.current?.pause()),
      stop: action('stop', () => {
        stopping.current = true
        audioRef.current?.pause()
        sessionState('none')
      }),
      nexttrack: action('nexttrack', () => handleNext(false)),
      previoustrack: action('previoustrack', () => handlePrev(true)),
      seekto: action('seekto', d => seek(d.seekTime)),
      seekforward: action('seekforward', d => seek((audioRef.current?.currentTime || 0) + (d.seekOffset ?? 10))),
      seekbackward: action('seekbackward', d => seek((audioRef.current?.currentTime || 0) - (d.seekOffset ?? 10)))
    }
    Object.entries(actions).forEach(([name, fn]) => { try { navigator.mediaSession.setActionHandler(name, fn) } catch { /* Platform-dependent action. */ } })
    return () => {
      Object.keys(actions).forEach(name => { try { navigator.mediaSession.setActionHandler(name, null) } catch { /* Platform-dependent action. */ } })
      sessionMetadata(null)
    }
  }, [diagnostic, safePlay, handleNext, handlePrev, seek])
  return (
    <AudioCtx.Provider value={{ ...state, currentIndex: state.index, togglePlay, seek, setVolume, setShuffle, setRepeat, setAutoplay: value => setPreference('autoplay', value), toggleShuffle: () => setShuffle(s => !s), toggleRepeat: () => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'), handleNext, handlePrev, playItem, addToQueue, playNext: item => addToQueue(item, true), removeFromQueue, reorderQueue, setCurrentIndex: index => load(index, true, 0), eqEnabled: state.eqEnabled, eqPreset: state.eqPreset, eqValues: state.eqValues, setEqEnabled, setEqPreset, setEqBand, resetEq, eqPresets: EQ_PRESETS }}>
      {children}
    </AudioCtx.Provider>
  )
}
export const useAudio = () => {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider')
  return ctx
}
