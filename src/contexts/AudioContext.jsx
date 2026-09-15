import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { readStored, writeStored, mediaKey, mediaUrl, validUrl } from '../lib/storage'
import { logPlaybackEvent } from '../lib/playbackDiagnostics'

const AudioCtx = createContext(null)
const clampVolume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 1
const initialPrefs = () => {
  const saved = readStored('v2_playback_preferences', {})
  return { volume: clampVolume(saved?.volume ?? readStored('v2_volume', 1)), shuffle: saved?.shuffle === true, repeat: ['none','one','all'].includes(saved?.repeat) ? saved.repeat : 'none', autoplay: saved?.autoplay !== false }
}

// Commands synchronously update one model. Media events never depend on React render timing.
export function AudioProvider({ children, storageKey = 'v2_player_state', onProgress, getResumeTime }) {
  const audioRef = useRef(null)
  const [state, setState] = useState(() => ({ queue: [], index: 0, activeItem: null, isPlaying: false, currentTime: 0, duration: 0, error: '', ...initialPrefs() }))
  const model = useRef(state)
  const generation = useRef(0)
  const pendingSeek = useRef(0)
  const visited = useRef(new Set())
  const callbacks = useRef({ onProgress, getResumeTime })
  callbacks.current = { onProgress, getResumeTime }
  const lastSaved = useRef(0)
  const cleared = useRef(false)
  const publish = useCallback(patch => {
    model.current = { ...model.current, ...patch }
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
  const safePlay = useCallback(async (reason = 'PLAY_REQUEST') => {
    const audio = audioRef.current
    if (!audio?.src) return
    const token = generation.current
    diagnostic(reason, audio)
    publish({ error: '' })
    try {
      await audio.play()
      if (token === generation.current) diagnostic('PLAY_SUCCESS', audio)
      return true
    } catch (error) {
      diagnostic('PLAY_REJECTED', audio, model.current.activeItem, `${error?.name || 'Error'}: ${error?.message || ''}`)
      if (token !== generation.current) return false
      const message = error?.name === 'NotAllowedError'
        ? 'Playback was blocked. Press Play to try again.'
        : error?.name === 'AbortError'
          ? 'Playback was interrupted while switching tracks. Press Play to try again.'
          : `Unable to play this audio: ${error?.message || 'unknown media error'}`
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
    audio.pause()
    publish({ index, activeItem: item, currentTime: 0, duration: 0, isPlaying: false, error: '' })
    const url = mediaUrl(item)
    if (!url || !validUrl(url)) {
      audio.removeAttribute('src'); audio.load()
      diagnostic('ERROR', audio, item, 'Item has no playable audio URL')
      publish({ error: 'This item has no playable audio URL. Choose another item.' })
      return
    }
    pendingSeek.current = Math.max(0, resume ?? callbacks.current.getResumeTime?.(item) ?? 0)
    audio.src = url
    audio.load()
    diagnostic('SOURCE_CHANGED', audio, item, reason)
    if (play) await safePlay('PLAY_REQUEST')
    persist()
  }, [diagnostic, persist, publish, report, safePlay])
  const handleNext = useCallback(async (auto = false) => {
    const s = model.current
    if (!s.queue.length) return
    diagnostic(auto ? 'ENDED' : 'MANUAL_NEXT')
    if (auto && s.repeat === 'one') { diagnostic('NEXT_SELECTED', audioRef.current, s.queue[s.index], 'repeat-one'); await load(s.index, true, 0, 'repeat-one'); return }
    if (auto && !s.autoplay) { publish({ isPlaying: false }); persist(); return }
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
    else { audioRef.current?.pause(); publish({ isPlaying: false }); persist() }
  }, [diagnostic, load, persist, publish])
  const handlePrev = useCallback(() => {
    const s = model.current
    if ((audioRef.current?.currentTime || 0) > 3 || s.index === 0) {
      if (audioRef.current) audioRef.current.currentTime = 0
      publish({ currentTime: 0 })
    } else load(s.index - 1, true, 0)
  }, [load, publish])
  useEffect(() => {
    // Keep one media instance under the provider's ownership. Besides avoiding
    // a rendered element being replaced outside the player lifecycle, this is
    // the instance exposed by window.Audio in the Playwright media fixture.
    const audio = audioRef.current || new Audio()
    audioRef.current = audio
    audio.preload = 'metadata'
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
        if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && Number.isFinite(audio.duration) && audio.duration > 0) {
          try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: audio.currentTime }) } catch { /* Ignore */ }
        }
      },
      durationchange: () => publish({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }),
      canplay: () => diagnostic('CANPLAY', audio),
      playing: () => { diagnostic('PLAYING', audio); lastTick = performance.now(); publish({ isPlaying: true, error: '' }); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; },
      pause: () => { diagnostic('PAUSE', audio); publish({ isPlaying: false }); report(); persist(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; },
      waiting: () => diagnostic('WAITING', audio),
      stalled: () => diagnostic('STALLED', audio),
      ended: () => { diagnostic('ENDED', audio); report(true); void handleNext(true); },
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
      hardStop()
      // Keep the stopped instance for an effect restart (including StrictMode).
      // All listeners and sources are cleared above; a real unmount releases
      // the provider ref. Playback still has exactly one media owner.
    }
  }, [storageKey, diagnostic, handleNext, load, persist, publish, report])
  const seek = useCallback(time => {
    const audio = audioRef.current
    if (audio && Number.isFinite(time) && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration))
      publish({ currentTime: audio.currentTime }); report(); persist()
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        try { navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: audio.currentTime }) } catch { /* Ignore */ }
      }
    }
  }, [persist, publish, report])
  const togglePlay = useCallback(() => {
    if (audioRef.current?.paused) void safePlay()
    else audioRef.current?.pause()
  }, [safePlay])
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
  useEffect(() => {
    if (!navigator.mediaSession || !state.activeItem) return
    const item = state.activeItem
    const artwork = item.image_url || item.cover_url || item.image
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: item.title || '', artist: item.artist || item.author || '', artwork: artwork ? [{ src: artwork }] : [] })
    } catch { /* Invalid artwork must not interrupt playback. */ }

    const updatePositionState = () => {
      if ('setPositionState' in navigator.mediaSession && audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audioRef.current.duration,
            playbackRate: audioRef.current.playbackRate || 1,
            position: audioRef.current.currentTime || 0
          })
        } catch { /* Ignore */ }
      }
    }
    updatePositionState()

    const actions = { play: () => safePlay('PLAY_REQUEST'), pause: () => audioRef.current?.pause(), nexttrack: () => handleNext(false), previoustrack: handlePrev, seekto: d => seek(d.seekTime) }
    Object.entries(actions).forEach(([name, fn]) => { try { navigator.mediaSession.setActionHandler(name, fn) } catch { /* Platform-dependent action. */ } })
    return () => {
      Object.keys(actions).forEach(name => { try { navigator.mediaSession.setActionHandler(name, null) } catch { /* Platform-dependent action. */ } })
      navigator.mediaSession.metadata = null
    }
  }, [state.activeItem, safePlay, handleNext, handlePrev, seek])
  return (
    <AudioCtx.Provider value={{ ...state, currentIndex: state.index, togglePlay, seek, setVolume, setShuffle, setRepeat, setAutoplay: value => setPreference('autoplay', value), toggleShuffle: () => setShuffle(s => !s), toggleRepeat: () => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'), handleNext, handlePrev, playItem, addToQueue, playNext: item => addToQueue(item, true), removeFromQueue, reorderQueue, setCurrentIndex: index => load(index, true, 0) }}>
      {children}
    </AudioCtx.Provider>
  )
}
export const useAudio = () => {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider')
  return ctx
}
