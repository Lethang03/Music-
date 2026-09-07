import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

const AudioCtx = createContext(null)

// Single authoritative audio engine
// Uses ONE primary audio element. No dual-audio swap to avoid source-of-truth confusion.
// Stale closure fix: all event handlers read from refs, not from closed-over state.

export function AudioProvider({ children }) {
  const audioRef = useRef(null)

  // Initialize audio element once, outside of React render
  if (!audioRef.current) {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'
  }

  const [activeItem, setActiveItem] = useState(null)
  const [queue, setQueue]           = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [volume, setVolumeState]    = useState(() => {
    try { return parseFloat(localStorage.getItem('v2_volume') ?? '1') } catch { return 1 }
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const [shuffle, setShuffle]         = useState(false)
  const [repeat, setRepeat]           = useState('none') // 'none' | 'one' | 'all'

  // Always-fresh refs for use inside event listeners (avoids stale closures)
  const queueRef        = useRef(queue)
  const currentIndexRef = useRef(currentIndex)
  const shuffleRef      = useRef(shuffle)
  const repeatRef       = useRef(repeat)
  const activeItemRef   = useRef(activeItem)

  useEffect(() => { queueRef.current = queue },              [queue])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { shuffleRef.current = shuffle },          [shuffle])
  useEffect(() => { repeatRef.current = repeat },            [repeat])
  useEffect(() => { activeItemRef.current = activeItem },    [activeItem])

  // ── helpers ──────────────────────────────────────────────────────────────
  const getAudio = () => audioRef.current

  const safePlay = (audio) => {
    const p = audio.play()
    if (p && typeof p.catch === 'function') {
      p.catch(err => {
        if (err.name !== 'AbortError') {
          console.warn('[Audio] play() rejected:', err.message)
        }
      })
    }
  }

  // ── volume ────────────────────────────────────────────────────────────────
  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(1, v))
    getAudio().volume = clamped
    setVolumeState(clamped)
    try { localStorage.setItem('v2_volume', String(clamped)) } catch {}
  }, [])

  useEffect(() => {
    getAudio().volume = volume
  }, []) // apply once on mount

  // ── navigation ────────────────────────────────────────────────────────────
  const handleNext = useCallback((isAuto = false) => {
    const q   = queueRef.current
    const idx = currentIndexRef.current
    const rep = repeatRef.current

    if (rep === 'one' && isAuto) {
      // Repeat current — restart it
      getAudio().currentTime = 0
      safePlay(getAudio())
      return
    }

    if (shuffleRef.current && q.length > 1) {
      let next
      do { next = Math.floor(Math.random() * q.length) } while (next === idx)
      setCurrentIndex(next)
      return
    }

    if (idx < q.length - 1) {
      setCurrentIndex(idx + 1)
    } else if (rep === 'all' && q.length > 0) {
      setCurrentIndex(0)
    } else {
      // End of queue
      getAudio().pause()
      setIsPlaying(false)
    }
  }, [])

  const handlePrev = useCallback(() => {
    const audio = getAudio()
    const idx   = currentIndexRef.current

    if (audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)
    } else if (idx > 0) {
      setCurrentIndex(idx - 1)
    } else {
      audio.currentTime = 0
      setCurrentTime(0)
    }
  }, [])

  // ── event listeners — mounted once ───────────────────────────────────────
  useEffect(() => {
    const audio = getAudio()

    const onTimeUpdate  = () => setCurrentTime(audio.currentTime)
    const onDuration    = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onPlay        = () => setIsPlaying(true)
    const onPause       = () => setIsPlaying(false)
    const onEnded       = () => handleNext(true)
    const onError       = (e) => {
      const err = audio.error
      console.error('[Audio] media error:', err?.code, err?.message)
      // Don't crash — just pause
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate',    onTimeUpdate)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('play',          onPlay)
    audio.addEventListener('pause',         onPause)
    audio.addEventListener('ended',         onEnded)
    audio.addEventListener('error',         onError)

    // Restore persisted state
    try {
      const saved = JSON.parse(localStorage.getItem('v2_player_state') ?? 'null')
      if (saved?.queue?.length) {
        setQueue(saved.queue)
        setCurrentIndex(saved.index ?? 0)
        if (saved.volume != null) setVolume(saved.volume)
        if (saved.repeat)  setRepeat(saved.repeat)
        if (saved.shuffle) setShuffle(saved.shuffle)
        // NOTE: Do NOT auto-play on restore — browser blocks it and it's jarring
        // We set the src so user can press play
        const item = saved.queue[saved.index ?? 0]
        if (item) {
          const url = item.audio_url || item.url
          if (url) {
            audio.src = url
            audio.load()
            if (saved.currentTime) audio.currentTime = saved.currentTime
            setActiveItem(item)
            setCurrentTime(saved.currentTime ?? 0)
            setDuration(0)
          }
        }
      }
    } catch (e) {
      console.warn('[Audio] Failed to restore persisted state:', e)
      try { localStorage.removeItem('v2_player_state') } catch {}
    }

    return () => {
      audio.removeEventListener('timeupdate',    onTimeUpdate)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('play',          onPlay)
      audio.removeEventListener('pause',         onPause)
      audio.removeEventListener('ended',         onEnded)
      audio.removeEventListener('error',         onError)
    }
  }, [handleNext, setVolume]) // handleNext is stable (useCallback with no deps)

  // ── media session ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !activeItem) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title:   activeItem.title   ?? 'Unknown',
      artist:  activeItem.artist  ?? activeItem.author ?? 'Unknown',
      album:   activeItem.album   ?? '',
      artwork: [{ src: activeItem.image_url || activeItem.cover_url || activeItem.image || '', sizes: '512x512', type: 'image/jpeg' }]
    })
    navigator.mediaSession.setActionHandler('play',          () => safePlay(getAudio()))
    navigator.mediaSession.setActionHandler('pause',         () => getAudio().pause())
    navigator.mediaSession.setActionHandler('nexttrack',     () => handleNext(false))
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev())
    navigator.mediaSession.setActionHandler('seekto',        (d) => { if (d.seekTime != null) seek(d.seekTime) })
  }, [activeItem, handleNext, handlePrev])

  // ── playback engine — reacts to currentIndex / queue changes ─────────────
  useEffect(() => {
    if (!queue.length) return
    const item = queue[currentIndex]
    if (!item) return

    const url = item.audio_url || item.url
    if (!url) {
      console.warn('[Audio] Track has no URL:', item)
      return
    }

    const audio = getAudio()

    // Only swap source if item changed
    if (activeItemRef.current?.id !== item.id) {
      audio.pause()
      audio.src = url
      audio.load()
      setActiveItem(item)
      setCurrentTime(0)
      setDuration(0)
      safePlay(audio)
    }
  }, [currentIndex, queue])

  // ── persistence save ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!queue.length) return
    try {
      localStorage.setItem('v2_player_state', JSON.stringify({
        queue, index: currentIndex, volume, repeat, shuffle,
        currentTime: Math.floor(currentTime)
      }))
    } catch {}
  }, [queue, currentIndex, volume, repeat, shuffle, currentTime])

  // ── public API ────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = getAudio()
    if (audio.paused) safePlay(audio)
    else audio.pause()
  }, [])

  const seek = useCallback((time) => {
    const audio = getAudio()
    if (isFinite(time) && isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration))
      setCurrentTime(audio.currentTime)
    }
  }, [])

  // Play a specific item, optionally with a new queue
  const playItem = useCallback((item, newQueue = null, index = 0) => {
    const audio = getAudio()
    const newQ  = newQueue ?? [item]
    const idx   = newQueue ? index : 0

    // Update queue refs immediately so handleNext has correct data
    setQueue(newQ)
    setCurrentIndex(idx)

    const url = item.audio_url || item.url
    if (!url) { console.warn('[Audio] playItem: no URL on item', item); return }

    audio.pause()
    audio.src = url
    audio.load()
    setActiveItem(item)
    setCurrentTime(0)
    safePlay(audio)
  }, [])

  const addToQueue = useCallback((item) => {
    setQueue(q => [...q, item])
  }, [])

  const removeFromQueue = useCallback((idx) => {
    setQueue(q => {
      const next = q.filter((_, i) => i !== idx)
      return next
    })
  }, [])

  const value = {
    activeItem,
    isPlaying, togglePlay,
    volume, setVolume,
    currentTime, duration, seek,
    queue, setQueue, currentIndex, setCurrentIndex,
    shuffle, setShuffle,
    repeat, setRepeat,
    handleNext, handlePrev,
    playItem, addToQueue, removeFromQueue,
  }

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}

export const useAudio = () => {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider')
  return ctx
}
