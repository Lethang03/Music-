import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'
import { readStored, writeStored, mediaKey, mediaUrl, validUrl } from '../lib/storage'

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
    // StrictMode cleanup can run before metadata applies the restored seek.
    writeStored(storageKey, { queue, index, currentTime: pendingSeek.current || currentTime })
    const { volume, shuffle, repeat, autoplay } = model.current
    writeStored('v2_playback_preferences', { volume, shuffle, repeat, autoplay })
    writeStored('v2_volume', volume)
  }, [storageKey])
  const report = useCallback((done = false, elapsed = 0) => {
    const s = model.current
    if (!audioRef.current?.readyState || pendingSeek.current) return
    if (s.activeItem) callbacks.current.onProgress?.(s.activeItem, audioRef.current?.currentTime || 0, audioRef.current?.duration || 0, done, elapsed)
  }, [])
  const safePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) return
    const token = generation.current
    publish({ error: '' })
    audio.play().catch(error => {
      if (token !== generation.current || error.name === 'AbortError') return
      publish({ isPlaying: false, error: error.name === 'NotAllowedError' ? 'Playback was blocked. Press Play to try again.' : 'Unable to play this audio. Check your connection or choose another item.' })
    })
  }, [publish])
  const load = useCallback((index, play = true, resume) => {
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
      publish({ error: 'This item has no playable audio URL. Choose another item.' })
      return
    }
    pendingSeek.current = Math.max(0, resume ?? callbacks.current.getResumeTime?.(item) ?? 0)
    audio.src = url
    audio.load()
    if (play) safePlay()
    persist()
  }, [persist, publish, report, safePlay])
  const handleNext = useCallback((auto = false) => {
    const s = model.current
    if (!s.queue.length) return
    if (auto && s.repeat === 'one') { load(s.index, true, 0); return }
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
    if (next < s.queue.length) load(next, true, 0)
    else { audioRef.current?.pause(); publish({ isPlaying: false }); persist() }
  }, [load, persist, publish])
  const handlePrev = useCallback(() => {
    const s = model.current
    if ((audioRef.current?.currentTime || 0) > 3 || s.index === 0) {
      if (audioRef.current) audioRef.current.currentTime = 0
      publish({ currentTime: 0 })
    } else load(s.index - 1, true, 0)
  }, [load, publish])
  useEffect(() => {
    // Effect-owned resource: StrictMode cleanup releases the discarded instance.
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = clampVolume(model.current.volume)
    audioRef.current = audio
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
        if (pendingSeek.current && Number.isFinite(audio.duration)) audio.currentTime = Math.min(pendingSeek.current, Math.max(0, audio.duration - 0.1))
        pendingSeek.current = 0
        publish({ duration: Number.isFinite(audio.duration) ? audio.duration : 0, currentTime: audio.currentTime })
      },
      durationchange: () => publish({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }),
      playing: () => { lastTick = performance.now(); publish({ isPlaying: true, error: '' }) },
      pause: () => { publish({ isPlaying: false }); report(); persist() },
      ended: () => { report(true); handleNext(true) },
      error: () => publish({ isPlaying: false, error: 'Audio could not be loaded. Check your connection or choose another item.' })
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
      window.removeEventListener('auth_signout', clearPlayer)
      window.removeEventListener('auth_cleared', clearPlayer)
      hardStop()
      audioRef.current = null
    }
  }, [storageKey, handleNext, load, persist, publish, report])
  const seek = useCallback(time => {
    const audio = audioRef.current
    if (audio && Number.isFinite(time) && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration))
      publish({ currentTime: audio.currentTime }); report(); persist()
    }
  }, [persist, publish, report])
  const togglePlay = useCallback(() => {
    if (audioRef.current?.paused) safePlay()
    else audioRef.current?.pause()
  }, [safePlay])
  const playItem = useCallback((item, newQueue = null, index = 0, resume) => {
    if (!item) return
    const queue = newQueue?.length ? newQueue : [item]
    const matching = queue[index] && mediaKey(queue[index]) === mediaKey(item) ? index : queue.findIndex(x => mediaKey(x) === mediaKey(item))
    if (matching < 0) { publish({ error: 'The selected item is not in this queue.' }); return }
    visited.current = new Set()
    publish({ queue })
    load(matching, true, resume)
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
    if (!s.activeItem) load(0, false, 0)
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
      if (index === s.index) load(model.current.index, s.isPlaying, 0)
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
    const actions = { play: safePlay, pause: () => audioRef.current?.pause(), nexttrack: () => handleNext(), previoustrack: handlePrev, seekto: d => seek(d.seekTime) }
    Object.entries(actions).forEach(([name, fn]) => { try { navigator.mediaSession.setActionHandler(name, fn) } catch { /* Platform-dependent action. */ } })
    return () => {
      Object.keys(actions).forEach(name => { try { navigator.mediaSession.setActionHandler(name, null) } catch { /* Platform-dependent action. */ } })
      navigator.mediaSession.metadata = null
    }
  }, [state.activeItem, safePlay, handleNext, handlePrev, seek])
  return <AudioCtx.Provider value={{ ...state, currentIndex: state.index, togglePlay, seek, setVolume, setShuffle, setRepeat, setAutoplay: value => setPreference('autoplay', value), toggleShuffle: () => setShuffle(s => !s), toggleRepeat: () => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'), handleNext, handlePrev, playItem, addToQueue, playNext: item => addToQueue(item, true), removeFromQueue, reorderQueue, setCurrentIndex: index => load(index, true, 0) }}>{children}</AudioCtx.Provider>
}
export const useAudio = () => {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider')
  return ctx
}
