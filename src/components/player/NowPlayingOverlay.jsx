import { mediaProvider } from '../../services/media'
import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import {
  Play, Pause, SkipForward, SkipBack,
  Shuffle, Repeat, Repeat1,
  Heart, ChevronLeft, Volume2, VolumeX,
  SlidersHorizontal, X, RotateCcw
} from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import TrackActions from '../TrackActions'
import { useLibrary } from '../../contexts/LibraryContext'
import { mediaKey } from '../../lib/storage'
import { useAudio } from '../../contexts/AudioContext'
import SyncedLyrics, { parseSyncedLyrics } from './SyncedLyrics'
import { markArtworkLoaded, isArtworkCached } from '../../lib/mediaCache'
import './NowPlayingOverlay.css'

function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Memoized Progress Bar ──────────────────────────────────────────────────
const NowPlayingProgress = memo(function NowPlayingProgress({ currentTime, duration, seek }) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="sv-np-progress-wrap">
      <div
        className="sv-np-progress-bar"
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            seek(currentTime + (e.key === 'ArrowRight' ? 5 : -5))
          }
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          seek(((e.clientX - rect.left) / rect.width) * duration)
        }}
      >
        <div className="sv-np-progress-track">
          <div className="sv-np-progress-fill" style={{ width: `${progress}%` }}>
            <div className="sv-np-progress-thumb" />
          </div>
        </div>
      </div>
      <div className="sv-np-time-row">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
})

// ─── Queue Item ─────────────────────────────────────────────────────────────
const QueueItem = memo(function QueueItem({
  item, idx, isActive, isPlaying, onSelect, onRemove, onReorder, canMoveUp, canMoveDown
}) {
  const art = mediaProvider.getArtworkUrl(item?.image_url || item?.cover_url || item?.image || '/icons/icon.svg')

  return (
    <div
      className={`sv-queue-item v2-np-queue-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(idx)}
    >
      <div className="sv-queue-idx" onClick={e => e.stopPropagation()}>
        {isActive ? (
          <div className="sv-soundwave-badge" aria-label="Now playing">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <span>{idx + 1}</span>
        )}
      </div>

      <img src={art} alt="" className="sv-queue-art v2-np-queue-art" loading="lazy" decoding="async" />

      <div className="v2-np-queue-meta">
        <strong>{item.title}</strong>
        <small>{item.artist || item.author || 'SoundVerse Artist'}</small>
      </div>

      <span className="sv-queue-duration">
        {formatTime(item.duration || 0)}
      </span>

      <div className="sv-queue-item-actions" onClick={e => e.stopPropagation()}>
        <button
          className="sv-queue-sub-btn"
          aria-label={`Play ${item.title}`}
          onClick={(e) => { e.stopPropagation(); onSelect(idx); }}
          title={`Play ${item.title}`}
        >
          <Play size={14} />
        </button>
        <button
          className="sv-queue-sub-btn"
          disabled={!canMoveUp}
          aria-label={`Move ${item.title} up`}
          onClick={(e) => { e.stopPropagation(); onReorder(idx, idx - 1); }}
          title="Move up"
        >
          ▲
        </button>
        <button
          className="sv-queue-sub-btn"
          disabled={!canMoveDown}
          aria-label={`Move ${item.title} down`}
          onClick={(e) => { e.stopPropagation(); onReorder(idx, idx + 1); }}
          title="Move down"
        >
          ▼
        </button>
        <button
          className="sv-queue-sub-btn"
          aria-label={`Remove ${item.title} from queue`}
          onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
          title={`Remove ${item.title} from queue`}
        >
          <X size={14} />
        </button>
        <TrackActions item={item} />
      </div>

      {isActive && (
        <span className="v2-np-playing-dot" aria-label="Now playing" style={{ display: 'none' }} />
      )}
    </div>
  )
})

// ─── Memoized Dynamic Ambient Backdrop ──────────────────────────────────────
const AmbientBackdrop = memo(function AmbientBackdrop({ artworkUrl }) {
  const activeUrl = artworkUrl && artworkUrl !== '/icons/icon.svg' ? artworkUrl : null

  const [layers, setLayers] = useState({
    current: activeUrl,
    prev: null,
    key: 0
  })
  const keyRef = useRef(0)
  const currentUrlRef = useRef(activeUrl)

  useEffect(() => {
    if (activeUrl === currentUrlRef.current) return
    const prevUrl = currentUrlRef.current
    currentUrlRef.current = activeUrl

    let isMounted = true
    let timer

    if (!activeUrl) {
      keyRef.current += 1
      const nextKey = keyRef.current
      setLayers({ current: null, prev: prevUrl, key: nextKey })
      timer = setTimeout(() => {
        if (isMounted) setLayers(l => (l.key === nextKey ? { ...l, prev: null } : l))
      }, 550)
      return () => {
        isMounted = false
        if (timer) clearTimeout(timer)
      }
    }

    const applyTransition = () => {
      if (!isMounted) return
      keyRef.current += 1
      const nextKey = keyRef.current
      setLayers({
        current: activeUrl,
        prev: prevUrl,
        key: nextKey
      })

      timer = setTimeout(() => {
        if (isMounted) setLayers(l => (l.key === nextKey ? { ...l, prev: null } : l))
      }, 500)
    }

    // Preload image before switching to avoid blank or white flash
    const img = new Image()
    img.src = activeUrl

    if (img.complete && img.naturalWidth > 0) {
      markArtworkLoaded(activeUrl)
      applyTransition()
    } else {
      img.onload = () => {
        markArtworkLoaded(activeUrl)
        applyTransition()
      }
      img.onerror = () => {
        if (!isMounted) return
        keyRef.current += 1
        setLayers({ current: null, prev: prevUrl, key: keyRef.current })
      }
    }

    return () => {
      isMounted = false
      img.onload = null
      img.onerror = null
      if (timer) clearTimeout(timer)
    }
  }, [activeUrl])

  return (
    <div className="sv-np-backdrop-layer" aria-hidden="true">
      {/* Fallback cosmic gradient base (always underneath) */}
      <div className="sv-np-fallback-cosmic" />

      {/* Previous artwork layer fading out */}
      {layers.prev && (
        <img
          key={`bg-prev-${layers.key}`}
          src={layers.prev}
          alt=""
          className="sv-np-ambient-img sv-np-blur-image sv-np-layer-fadeout"
          loading="eager"
          decoding="async"
          onError={e => {
            e.currentTarget.onerror = null
            e.currentTarget.src = '/icons/icon.svg'
          }}
        />
      )}

      {/* Current artwork layer fading in */}
      {layers.current && (
        <img
          key={`bg-curr-${layers.key}`}
          src={layers.current}
          alt=""
          className="sv-np-ambient-img sv-np-blur-image sv-np-layer-fadein"
          loading="eager"
          decoding="async"
          onError={e => {
            e.currentTarget.onerror = null
            e.currentTarget.src = '/icons/icon.svg'
          }}
        />
      )}

      {/* Atmospheric overlays: color preservation & contrast enhancement */}
      <div className="sv-np-ambient-overlay" />
      <div className="sv-np-ambient-vignette" />
    </div>
  )
})

// ─── Memoized Queue List ───────────────────────────────────────────────────
const QueueList = memo(function QueueList({
  queue, currentIndex, isPlaying, onSelect, onRemove, onReorder
}) {
  return (
    <div className="sv-np-queue-list">
      {queue.map((item, idx) => (
        <QueueItem
          key={`${item.id}-${idx}`}
          item={item}
          idx={idx}
          isActive={idx === currentIndex}
          isPlaying={isPlaying}
          onSelect={onSelect}
          onRemove={onRemove}
          onReorder={onReorder}
          canMoveUp={idx > 0}
          canMoveDown={idx < queue.length - 1}
        />
      ))}
      {queue.length === 0 && (
        <p style={{ color: '#64748b', padding: '32px 0', textAlign: 'center', fontSize: '0.88rem' }}>
          Queue is empty
        </p>
      )}
    </div>
  )
}, (prev, next) => {
  return (
    prev.currentIndex === next.currentIndex &&
    prev.isPlaying === next.isPlaying &&
    prev.queue === next.queue &&
    prev.onSelect === next.onSelect &&
    prev.onRemove === next.onRemove &&
    prev.onReorder === next.onReorder
  )
})

// ─── Audio Settings Popover ────────────────────────────────────────────────
const AudioSettingsPopover = memo(function AudioSettingsPopover({
  isOpen,
  onClose,
  eqEnabled,
  setEqEnabled,
  eqPreset,
  setEqPreset,
  eqValues,
  setEqBand,
  resetEq,
  eqPresets
}) {
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = e => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    const handleClickOutside = e => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        const trigger = document.querySelector('.sv-np-eq-btn')
        if (trigger && trigger.contains(e.target)) return
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const presetList = Object.keys(eqPresets || {})
  if (!presetList.includes('Custom')) {
    presetList.push('Custom')
  }

  const safeValues = eqValues || { bass: 0, mid: 0, treble: 0 }

  return (
    <div
      ref={popoverRef}
      className="sv-np-eq-popover"
      role="dialog"
      aria-label="Audio settings"
      aria-modal="false"
    >
      <div className="sv-np-eq-popover-header">
        <div className="sv-np-eq-popover-title">
          <SlidersHorizontal size={15} className="sv-np-eq-title-icon" aria-hidden="true" />
          <span>Audio Settings</span>
        </div>
        <button
          type="button"
          className="sv-np-eq-close-btn"
          onClick={onClose}
          aria-label="Close audio settings"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Master Equalizer Switch */}
      <div className="sv-np-eq-master-row">
        <div className="sv-np-eq-master-label">
          <span className="sv-np-eq-label-text">Equalizer</span>
          <span className={`sv-np-eq-status-badge ${eqEnabled ? 'active' : ''}`}>
            {eqEnabled ? 'Active' : 'Bypassed'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(eqEnabled)}
          aria-label="Toggle Equalizer"
          className={`sv-np-toggle-switch ${eqEnabled ? 'checked' : ''}`}
          onClick={() => setEqEnabled(v => !v)}
        >
          <span className="sv-np-toggle-thumb" />
        </button>
      </div>

      {/* Preset Selector */}
      <div className="sv-np-eq-preset-row">
        <label htmlFor="sv-eq-preset-select" className="sv-np-eq-preset-label">
          Preset
        </label>
        <div className="sv-np-select-wrapper">
          <select
            id="sv-eq-preset-select"
            className="sv-np-eq-preset-select"
            value={eqPreset || 'Default'}
            onChange={e => setEqPreset(e.target.value)}
          >
            {presetList.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Frequency Bands */}
      <div className={`sv-np-eq-bands ${!eqEnabled ? 'eq-dimmed' : ''}`}>
        {/* Bass Band */}
        <div className="sv-np-eq-band">
          <div className="sv-np-eq-band-header">
            <span className="sv-np-eq-band-name">Bass <small>120Hz</small></span>
            <span className="sv-np-eq-band-val">
              {safeValues.bass > 0 ? `+${safeValues.bass}` : safeValues.bass} dB
            </span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={safeValues.bass}
            onChange={e => setEqBand('bass', Number(e.target.value))}
            aria-label="Bass gain"
            className="sv-np-eq-slider"
          />
        </div>

        {/* Mid Band */}
        <div className="sv-np-eq-band">
          <div className="sv-np-eq-band-header">
            <span className="sv-np-eq-band-name">Mid <small>1kHz</small></span>
            <span className="sv-np-eq-band-val">
              {safeValues.mid > 0 ? `+${safeValues.mid}` : safeValues.mid} dB
            </span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={safeValues.mid}
            onChange={e => setEqBand('mid', Number(e.target.value))}
            aria-label="Mid gain"
            className="sv-np-eq-slider"
          />
        </div>

        {/* Treble Band */}
        <div className="sv-np-eq-band">
          <div className="sv-np-eq-band-header">
            <span className="sv-np-eq-band-name">Treble <small>8kHz</small></span>
            <span className="sv-np-eq-band-val">
              {safeValues.treble > 0 ? `+${safeValues.treble}` : safeValues.treble} dB
            </span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={safeValues.treble}
            onChange={e => setEqBand('treble', Number(e.target.value))}
            aria-label="Treble gain"
            className="sv-np-eq-slider"
          />
        </div>
      </div>

      {/* Footer Reset */}
      <div className="sv-np-eq-popover-footer">
        <button
          type="button"
          className="sv-np-eq-reset-btn"
          onClick={resetEq}
          title="Reset equalizer to flat"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span>Reset to Flat</span>
        </button>
      </div>
    </div>
  )
})

// ─── Main Now Playing Fullscreen Overlay ────────────────────────────────────
export default function NowPlayingOverlay({
  onClose, isClosing, activeItem, isPlaying, togglePlay,
  currentTime, duration, seek, volume, setVolume,
  handleNext, handlePrev, shuffle, setShuffle, repeat, setRepeat, queue, currentIndex
}) {
  const {
    setCurrentIndex, removeFromQueue, reorderQueue,
    eqEnabled, eqPreset, eqValues, setEqEnabled, setEqPreset, setEqBand, resetEq, eqPresets
  } = useAudio()
  const { favorites, toggleFavorite, tracks } = useLibrary()
  const liked = favorites.some(x => mediaKey(x) === mediaKey(activeItem))
  
  // Tabs: 'playing' | 'queue' | 'lyrics'
  const [activeTab, setActiveTab] = useState('playing')
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const dialogRef = useRef(null)
  useDialog(dialogRef, onClose, !showAudioSettings)

  const prevVolumeRef = useRef(volume > 0 ? volume : 1)
  useEffect(() => {
    if (volume > 0) {
      prevVolumeRef.current = volume
    }
  }, [volume])

  const onSelectRef = useRef(setCurrentIndex)
  onSelectRef.current = setCurrentIndex
  const handleSelectQueue = useCallback((idx) => {
    onSelectRef.current?.(idx)
  }, [])

  const onRemoveRef = useRef(removeFromQueue)
  onRemoveRef.current = removeFromQueue
  const handleRemoveQueue = useCallback((idx) => {
    onRemoveRef.current?.(idx)
  }, [])

  const onReorderRef = useRef(reorderQueue)
  onReorderRef.current = reorderQueue
  const handleReorderQueue = useCallback((src, target) => {
    onReorderRef.current?.(src, target)
  }, [])

  const artworkUrl = useMemo(() => {
    return mediaProvider.getArtworkUrl(activeItem?.image_url || activeItem?.cover_url || activeItem?.image || '/icons/icon.svg')
  }, [activeItem?.image_url, activeItem?.cover_url, activeItem?.image, activeItem?.id])
  
  const lyricsItem = useMemo(() => {
    return activeItem?.type !== 'episode' && !activeItem?.podcast_id
      ? tracks.find(track => track.id === activeItem?.id) || activeItem
      : activeItem
  }, [tracks, activeItem])

  const syncedLyrics = useMemo(() => {
    return activeItem?.type !== 'episode' && !activeItem?.podcast_id && parseSyncedLyrics(lyricsItem?.synced_lyrics).length > 0
  }, [activeItem, lyricsItem])

  // Fullscreen subtle parallax
  const handleMouseMove = (e) => {
    if (typeof window === 'undefined' || window.innerWidth <= 1024) return
    const { clientX, clientY, currentTarget } = e
    const rect = currentTarget.getBoundingClientRect()
    const xRatio = ((clientX - rect.left) / rect.width) - 0.5
    const yRatio = ((clientY - rect.top) / rect.height) - 0.5
    currentTarget.style.setProperty('--np-tilt-x', `${(xRatio * 8).toFixed(1)}px`)
    currentTarget.style.setProperty('--np-tilt-y', `${(yRatio * 8).toFixed(1)}px`)
  }

  const handleMouseLeave = (e) => {
    e.currentTarget.style.setProperty('--np-tilt-x', '0px')
    e.currentTarget.style.setProperty('--np-tilt-y', '0px')
  }

  // ─── Artwork 3D Interactive Hover & Parallax ──────────────────────────────
  const artFrameRef = useRef(null)
  const [isArtHovered, setIsArtHovered] = useState(false)
  const rafTiltRef = useRef(null)

  const handleArtMouseMove = useCallback((e) => {
    if (!artFrameRef.current) return
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (!window.matchMedia('(hover: hover)').matches) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    }

    const rect = artFrameRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const normX = Math.max(-1, Math.min(1, (x - centerX) / centerX))
    const normY = Math.max(-1, Math.min(1, (y - centerY) / centerY))

    // Smooth 3D tilt angles (max ~8.5deg)
    const rotateX = normY * -8.5
    const rotateY = normX * 8.5
    const glareX = Math.round((x / rect.width) * 100)
    const glareY = Math.round((y / rect.height) * 100)

    if (rafTiltRef.current) cancelAnimationFrame(rafTiltRef.current)
    rafTiltRef.current = requestAnimationFrame(() => {
      const el = artFrameRef.current
      if (!el) return
      el.style.setProperty('--art-tilt-x', `${rotateY.toFixed(2)}deg`)
      el.style.setProperty('--art-tilt-y', `${rotateX.toFixed(2)}deg`)
      el.style.setProperty('--art-scale', '1.035')
      el.style.setProperty('--art-lift', '-5px')
      el.style.setProperty('--glare-x', `${glareX}%`)
      el.style.setProperty('--glare-y', `${glareY}%`)
      el.style.setProperty('--glare-opacity', '0.75')
    })
  }, [])

  const handleArtMouseEnter = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return
    if (typeof window !== 'undefined' && window.matchMedia) {
      if (!window.matchMedia('(hover: hover)').matches) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    }
    setIsArtHovered(true)
  }, [])

  const handleArtMouseLeave = useCallback(() => {
    if (rafTiltRef.current) cancelAnimationFrame(rafTiltRef.current)
    setIsArtHovered(false)
    const el = artFrameRef.current
    if (!el) return
    el.style.setProperty('--art-tilt-x', '0deg')
    el.style.setProperty('--art-tilt-y', '0deg')
    el.style.setProperty('--art-scale', '1')
    el.style.setProperty('--art-lift', '0px')
    el.style.setProperty('--glare-opacity', '0')
  }, [])

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div
      ref={dialogRef}
      className={`v2-np-fullscreen sv-np-fullscreen ${isClosing ? 'closing' : ''}`}
      data-tab={activeTab}
      data-panel={activeTab === 'lyrics' ? 'lyrics' : 'queue'}
      data-playing={isPlaying}
      role="dialog"
      aria-label="Now playing"
      aria-modal="true"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={e => {
        if (e.key === ' ' && !e.target.closest('button, input, select, textarea, summary, [role="slider"], [contenteditable="true"]')) {
          e.preventDefault(); togglePlay()
        }
      }}
    >
      {/* Dynamic Ambient Artwork Backdrop */}
      <AmbientBackdrop artworkUrl={artworkUrl} />

      <div className="sv-np-container">
        {/* ─── Top Header Navigation ─── */}
        <header className="sv-np-header">
          <div className="sv-np-brand">
            <button
              className="sv-np-back-btn v2-icon-btn"
              onClick={onClose}
              title="Close"
              aria-label="Close"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="sv-np-brand-text">
              <div className="sv-np-brand-header">
                <svg viewBox="0 0 24 24" width="15" height="15" className="sv-star-sparkle" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <span className="sv-np-brand-name">SOUNDVERSE</span>
              </div>
              <span className="sv-np-brand-tagline">LET THE MUSIC STAY WITH YOU</span>
            </div>
          </div>

          {/* Top Pill Tabs */}
          <nav className="sv-np-tabs" role="tablist" aria-label="Now Playing views">
            <button
              role="button"
              className={`sv-np-tab-btn ${activeTab === 'playing' ? 'active' : ''}`}
              onClick={() => setActiveTab('playing')}
              aria-selected={activeTab === 'playing'}
            >
              Now Playing
            </button>
            <button
              role="button"
              className={`sv-np-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
              aria-selected={activeTab === 'queue'}
            >
              Queue
            </button>
            <button
              role="button"
              className={`sv-np-tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('lyrics')}
              aria-selected={activeTab === 'lyrics'}
            >
              Lyrics
            </button>
          </nav>

          {/* Right Top Action */}
          <div className="sv-np-top-actions">
            <TrackActions item={activeItem} />
          </div>
        </header>

        {/* ─── Main Two-Column Body ─── */}
        <div className="sv-np-body">
          {/* Ambient Left Decorations */}
          <div className="sv-np-cursive-accent" aria-hidden="true">
            Music<br />Heals<br />Everything
          </div>
          <div className="sv-np-stage-tagline" aria-hidden="true">
            A SMALL<br />SONG<br />FOR A BRIGHTER<br />TOMORROW
          </div>

          {/* Left Column: Stage & Controls */}
          <section className="sv-np-stage">

            {/* Artwork Frame with 3D Tilt & Specular Glare */}
            <div
              ref={artFrameRef}
              className={`sv-np-artwork-frame ${isPlaying ? 'is-playing' : ''} ${isArtHovered ? 'is-hovered' : ''}`}
              onMouseEnter={handleArtMouseEnter}
              onMouseMove={handleArtMouseMove}
              onMouseLeave={handleArtMouseLeave}
            >
              <div className="sv-np-artwork-glow" aria-hidden="true" />
              <img
                src={artworkUrl}
                alt={activeItem?.title || 'SoundVerse artwork'}
                className="sv-np-artwork-img"
                loading={isArtworkCached(artworkUrl) ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() => markArtworkLoaded(artworkUrl)}
                onError={e => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = '/icons/icon.svg'
                }}
              />
              <div className="sv-np-artwork-glare" aria-hidden="true" />
            </div>

            {/* Track Info & Quick Actions */}
            <div className="sv-np-meta-row">
              <div className="sv-np-meta-info">
                <h1 className="sv-np-track-title" title={activeItem?.title}>
                  {activeItem?.title || 'No track selected'}
                </h1>
                <p className="sv-np-track-artist" title={activeItem?.artist || activeItem?.author}>
                  {activeItem?.artist || activeItem?.author || 'SoundVerse'}
                </p>
              </div>

              <div className="sv-np-meta-actions">
                <button
                  className={`sv-np-action-btn ${liked ? 'liked' : ''}`}
                  title={liked ? 'Remove favorite' : 'Favorite'}
                  aria-pressed={liked}
                  onClick={() => toggleFavorite(activeItem)}
                >
                  <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <TrackActions item={activeItem} />
              </div>
            </div>

            {/* Progress Slider */}
            <NowPlayingProgress
              currentTime={currentTime}
              duration={duration}
              seek={seek}
            />

            {/* Playback Controls */}
            <div className="sv-np-controls-row">
              <button
                className={`sv-np-ctrl-btn ${shuffle ? 'active' : ''}`}
                onClick={() => setShuffle(s => !s)}
                title="Shuffle"
                aria-label="Shuffle"
                aria-pressed={Boolean(shuffle)}
              >
                <Shuffle size={20} />
              </button>

              <button
                className="sv-np-ctrl-btn"
                onClick={handlePrev}
                title="Previous"
                aria-label="Previous"
              >
                <SkipBack size={26} fill="currentColor" />
              </button>

              <button
                className="sv-np-hero-play-btn"
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={28} fill="currentColor" />
                ) : (
                  <Play size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
                )}
              </button>

              <button
                className="sv-np-ctrl-btn"
                onClick={() => handleNext(false)}
                title="Next"
                aria-label="Next"
              >
                <SkipForward size={26} fill="currentColor" />
              </button>

              <button
                className={`sv-np-ctrl-btn ${repeat !== 'none' ? 'active' : ''}`}
                onClick={() => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')}
                title={`Repeat: ${repeat}`}
                aria-label={`Repeat: ${repeat}`}
              >
                <RepeatIcon size={20} />
              </button>
            </div>
          </section>

          {/* Right Column: Up Next Glass Card */}
          <section className="sv-np-panel-col">
            <div className="sv-np-glass-card">
              {/* Card Header */}
              <div className="sv-np-card-header">
                <span className="sv-np-card-title">
                  {activeTab === 'lyrics' ? 'LYRICS' : 'UP NEXT'}
                </span>
                <span className="sv-np-card-count">
                  {activeTab === 'lyrics' ? (syncedLyrics ? 'Synchronized' : 'Plain Text') : `${queue.length} tracks`}
                </span>
              </div>

              {/* Card Body */}
              <div className="sv-np-card-body" id="now-playing-panel">
                {activeTab === 'lyrics' ? (
                  <div className="sv-np-lyrics-container">
                    {syncedLyrics ? (
                      <SyncedLyrics
                        key={activeItem?.id}
                        lyrics={lyricsItem?.synced_lyrics}
                        currentTime={currentTime}
                        seek={seek}
                      />
                    ) : (
                      <p className="sv-np-plain-lyrics">
                        {lyricsItem?.lyrics || 'No lyrics available for this track.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <QueueList
                    queue={queue}
                    currentIndex={currentIndex}
                    isPlaying={isPlaying}
                    onSelect={handleSelectQueue}
                    onRemove={handleRemoveQueue}
                    onReorder={handleReorderQueue}
                  />
                )}
              </div>

              {/* Bottom Volume Control */}
              <div className="sv-np-card-volume">
                <button
                  className="sv-np-vol-icon-btn"
                  onClick={() => {
                    if (volume > 0) {
                      prevVolumeRef.current = volume
                      setVolume(0)
                    } else {
                      setVolume(prevVolumeRef.current || 1)
                    }
                  }}
                  aria-label={volume > 0 ? 'Mute' : 'Unmute'}
                  title={volume > 0 ? 'Mute' : 'Unmute'}
                >
                  {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    if (val > 0) prevVolumeRef.current = val
                    setVolume(val)
                  }}
                  className="sv-np-vol-slider"
                  aria-label="Volume"
                />
                <span className="sv-np-vol-pct">{Math.round(volume * 100)}%</span>
                <div className="sv-np-eq-wrapper">
                  <button
                    type="button"
                    className={`sv-np-eq-btn ${showAudioSettings ? 'active' : ''} ${eqEnabled ? 'is-enabled' : ''}`}
                    onClick={() => setShowAudioSettings(v => !v)}
                    aria-label="Audio settings"
                    aria-expanded={showAudioSettings}
                    aria-haspopup="dialog"
                    title="Audio settings"
                  >
                    <SlidersHorizontal size={18} className="sv-np-eq-icon" aria-hidden="true" />
                    {eqEnabled && <span className="sv-np-eq-dot" aria-hidden="true" />}
                  </button>
                  <AudioSettingsPopover
                    isOpen={showAudioSettings}
                    onClose={() => setShowAudioSettings(false)}
                    eqEnabled={eqEnabled}
                    setEqEnabled={setEqEnabled}
                    eqPreset={eqPreset}
                    setEqPreset={setEqPreset}
                    eqValues={eqValues}
                    setEqBand={setEqBand}
                    resetEq={resetEq}
                    eqPresets={eqPresets}
                  />
                </div>
              </div>

              {/* Ambient Quote Card */}
              <div className="sv-np-quote-box">
                <svg viewBox="0 0 24 24" width="18" height="18" className="sv-quote-star" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <div className="sv-quote-content">
                  <p className="sv-quote-text">Good music makes everything feel a little lighter.</p>
                  <div className="sv-quote-line" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ─── Bottom Footer Bar ─── */}
        <footer className="sv-np-footer">
          <div className="sv-bottom-pill">
            <svg viewBox="0 0 24 24" width="14" height="14" className="sv-star-sparkle" fill="currentColor">
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
            <span>Good music<br />Brighter days</span>
          </div>

          <div className="sv-bottom-tagline">
            <span className="sv-tagline-dash" />
            <span>SOUNDVERSE • LET THE MUSIC STAY WITH YOU</span>
            <span className="sv-tagline-dash" />
          </div>
        </footer>
      </div>
    </div>
  )
}
