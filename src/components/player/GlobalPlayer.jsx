import React, { useState, useCallback, useRef } from 'react'
import {
  Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, ListMusic, Shuffle, Repeat, Repeat1,
  Heart, Maximize2, ChevronDown, MoreHorizontal, X
} from 'lucide-react'
import { useDialog } from '../../lib/useDialog'
import TrackActions from '../TrackActions'
import { useLibrary } from '../../contexts/LibraryContext'
import { mediaKey } from '../../lib/storage'
import { useAudio } from '../../contexts/AudioContext'
import TiltCard from '../ui/TiltCard'

// ─── helpers ───────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Now Playing fullscreen overlay ────────────────────────────────────────
function NowPlaying({ onClose, isClosing, activeItem, isPlaying, togglePlay,
  currentTime, duration, seek, volume, setVolume,
  handleNext, handlePrev, shuffle, setShuffle, repeat, setRepeat, queue, currentIndex }) {

  const { setCurrentIndex, removeFromQueue, reorderQueue } = useAudio()
  const { favorites, toggleFavorite } = useLibrary()
  const liked = favorites.some(x => mediaKey(x) === mediaKey(activeItem))
  const [activeTab, setActiveTab] = useState('queue')
  const dialogRef = useRef(null)
  useDialog(dialogRef, onClose)
  const artworkUrl = activeItem?.image_url || activeItem?.cover_url || activeItem?.image
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div ref={dialogRef} className={`v2-np-fullscreen ${isClosing ? 'closing' : ''}`} role="dialog" aria-label="Now playing" aria-modal="true">
      {/* Blurred background — atmospheric only, z-index: 0 */}
      <div
        className="v2-np-blur-bg"
        style={{ backgroundImage: `url(${artworkUrl})` }}
        aria-hidden="true"
      />
      {/* Dark overlay, z-index: 1 */}
      <div className="v2-np-overlay" aria-hidden="true" />

      {/* All content z-index: 2 */}
      <div className="v2-np-inner">
        {/* Header row */}
        <header className="v2-np-topbar">
          <button className="v2-icon-btn" onClick={onClose} title="Close">
            <ChevronDown size={24} />
          </button>
          <div className="v2-np-title-info">
            <span className="v2-np-context-label">
              {isPlaying && (
                <span className="v2-mini-visualizer">
                  <span className="v2-bar"></span>
                  <span className="v2-bar"></span>
                  <span className="v2-bar"></span>
                </span>
              )}
              NOW PLAYING
            </span>
          </div>
          <TrackActions item={activeItem} />
        </header>

        {/* Main body: artwork + controls on left, panel on right */}
        <div className="v2-np-body">
          {/* Left/Center: artwork + controls */}
          <div className="v2-np-main">
            <TiltCard className={`v2-np-artwork-wrap ${isPlaying ? 'is-playing' : ''}`}>
              <div className="v2-vinyl-disc-container">
                <div className="v2-vinyl-disc" />
              </div>
              <img src={artworkUrl} alt={activeItem?.title ?? ''} className="v2-np-artwork-img" />
            </TiltCard>

            <div className="v2-np-meta">
              <div className="v2-np-meta-text">
                <h2 className="v2-np-track-title">{activeItem?.title}</h2>
                <p  className="v2-np-track-artist">{activeItem?.artist || activeItem?.author}</p>
              </div>
              <button className="v2-icon-btn" title={liked ? 'Remove favorite' : 'Favorite'} aria-pressed={liked} onClick={() => toggleFavorite(activeItem)}>
                <Heart size={20} />
              </button>
            </div>

            {/* Progress */}
            <div className="v2-np-progress-row">
              <span className="v2-np-time">{formatTime(currentTime)}</span>
              <div
                className="v2-np-seek-bar"
                role="slider" tabIndex={0} aria-label="Playback position" onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek(currentTime + (e.key === 'ArrowRight' ? 5 : -5)) } }}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  seek(((e.clientX - rect.left) / rect.width) * duration)
                }}
              >
                <div className="v2-np-seek-track">
                  <div className="v2-np-seek-fill" style={{ width: `${progress}%` }}>
                    <div className="v2-np-seek-thumb" />
                  </div>
                </div>
              </div>
              <span className="v2-np-time">{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="v2-np-controls">
              <button
                className={`v2-control-secondary ${shuffle ? 'active' : ''}`}
                onClick={() => setShuffle(s => !s)}
                title="Shuffle"
              >
                <Shuffle size={20} />
              </button>
              <button className="v2-control-btn" onClick={handlePrev} title="Previous">
                <SkipBack size={28} fill="currentColor" />
              </button>
              <button className="v2-np-play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <Pause size={28} fill="currentColor" />
                  : <Play  size={28} fill="currentColor" style={{ marginLeft: '3px' }} />
                }
              </button>
              <button className="v2-control-btn" onClick={() => handleNext(false)} title="Next">
                <SkipForward size={28} fill="currentColor" />
              </button>
              <button
                className={`v2-control-secondary ${repeat !== 'none' ? 'active' : ''}`}
                onClick={() => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')}
                title={`Repeat: ${repeat}`}
              >
                <RepeatIcon size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="v2-np-volume">
              <button className="v2-icon-btn" onClick={() => setVolume(volume > 0 ? 0 : 1)}>
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="v2-volume-slider"
                aria-label="Volume"
              />
            </div>
          </div>

          {/* Right panel: tabs */}
          <aside className="v2-np-panel">
            <div className="v2-np-tabs">
              <button
                className={`v2-np-tab ${activeTab === 'queue' ? 'active' : ''}`}
                onClick={() => setActiveTab('queue')}
              >Queue</button>
              <button
                className={`v2-np-tab ${activeTab === 'lyrics' ? 'active' : ''}`}
                onClick={() => setActiveTab('lyrics')}
              >Lyrics</button>
            </div>

            <div className="v2-np-panel-body">
              {activeTab === 'queue' ? (
                <div className="v2-np-queue">
                  <p className="v2-np-queue-heading">UP NEXT</p>
                  {queue.map((item, idx) => {
                    const art = item.image_url || item.cover_url || item.image
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className={`v2-np-queue-item ${idx === currentIndex ? 'active' : ''}`}
                      >
                        <button aria-label={`Play ${item.title}`} onClick={() => setCurrentIndex(idx)}><Play size={16} /></button>
                        <button aria-label={`Remove ${item.title} from queue`} onClick={() => removeFromQueue(idx)}><X size={16} /></button>
                        <img src={art} alt="" className="v2-np-queue-art" />
                        <div className="v2-np-queue-meta">
                          <strong>{item.title}</strong>
                          <small>{item.artist || item.author}</small>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 8 }}>
                          <button disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 10 }} onClick={() => reorderQueue?.(idx, idx - 1)}>▲</button>
                          <button disabled={idx === queue.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 10 }} onClick={() => reorderQueue?.(idx, idx + 1)}>▼</button>
                        </div>
                        {idx === currentIndex && (
                          <span className="v2-np-playing-dot" aria-label="Now playing" />
                        )}
                      </div>
                    )
                  })}
                  {queue.length === 0 && (
                    <p style={{ color: 'var(--text-tertiary)', padding: '24px 0', textAlign: 'center' }}>
                      Queue is empty
                    </p>
                  )}
                </div>
              ) : (
                <div className="v2-np-lyrics">
                  <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '48px 0' }}>
                    {activeItem?.lyrics || 'No lyrics available for this item.'}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        /* ── Now Playing fullscreen ── */
        .v2-np-fullscreen {
          background: #0B0B13;
          position: fixed;
          /* Respect sidebar and topbar on desktop */
          top: var(--topbar-height);
          left: var(--sidebar-width);
          right: 0;
          bottom: var(--player-height);
          z-index: 70;
          overflow: hidden;
          animation: v2-np-slide-up var(--transition-cinematic) forwards;
        }
        .v2-np-fullscreen.closing {
          animation: v2-np-slide-down 0.3s forwards;
        }
        @keyframes v2-np-slide-down {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }

        @keyframes v2-np-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Blurred background — purely atmospheric */
        .v2-np-blur-bg {
          position: absolute;
          inset: -60px;
          background-size: cover;
          background-position: center;
          filter: blur(80px) saturate(1.4) brightness(0.6);
          transform: scale(1.15);
          z-index: 0;
          pointer-events: none;
        }
        .v2-np-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            rgba(11,11,19,0.6) 0%,
            rgba(11,11,19,0.85) 50%,
            rgba(11,11,19,0.97) 100%
          );
          z-index: 1;
          pointer-events: none;
        }

        /* Inner wrapper — all real content lives here */
        .v2-np-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* Header */
        .v2-np-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          flex-shrink: 0;
        }
        .v2-np-title-info {
          text-align: center;
        }
        .v2-np-context-label {
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          color: var(--text-secondary);
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .v2-mini-visualizer {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 12px;
        }
        .v2-mini-visualizer .v2-bar {
          width: 3px;
          background: var(--accent-primary);
          border-radius: 1px;
          animation: v2-vis-bounce 0.5s ease infinite alternate;
        }
        .v2-mini-visualizer .v2-bar:nth-child(2) { animation-delay: 0.2s; animation-duration: 0.4s; }
        .v2-mini-visualizer .v2-bar:nth-child(3) { animation-delay: 0.4s; animation-duration: 0.6s; }
        
        @keyframes v2-vis-bounce {
          0% { height: 3px; }
          100% { height: 12px; }
        }

        /* Body */
        .v2-np-body {
          flex: 1;
          display: flex;
          gap: 48px;
          padding: 0 48px 24px;
          min-height: 0;
          overflow: hidden;
        }

        /* Left: artwork + playback */
        .v2-np-main {
          flex: 1 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          min-width: 0;
        }

        .v2-np-artwork-wrap {
          width: 100%;
          max-width: min(38vh, 420px);
          aspect-ratio: 1;
          /* Removed overflow: hidden so vinyl can slide out */
          flex-shrink: 0;
          position: relative;
        }
        .v2-np-artwork-img {
          width: 100%; height: 100%;
          object-fit: cover;
          border-radius: 20px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7);
          position: relative;
          z-index: 2;
        }

        /* Vinyl Disc */
        .v2-vinyl-disc-container {
          position: absolute;
          top: 2%; bottom: 2%; right: 0;
          aspect-ratio: 1;
          z-index: 1;
          transform: translateX(0);
          transition: transform var(--transition-cinematic);
          border-radius: 50%;
          box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        }
        .v2-np-artwork-wrap.is-playing .v2-vinyl-disc-container {
          transform: translateX(45%);
        }
        .v2-vinyl-disc {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: 
            repeating-radial-gradient(
              #111,
              #111 4px,
              #1a1a1a 5px,
              #111 6px
            );
          animation: v2-vinyl-spin 4s linear infinite;
          animation-play-state: paused;
          position: relative;
        }
        .v2-vinyl-disc::after {
          content: '';
          position: absolute;
          inset: 38%;
          background: var(--accent-gradient);
          border-radius: 50%;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }
        .v2-vinyl-disc::before {
          content: '';
          position: absolute;
          inset: 48%;
          background: #111;
          border-radius: 50%;
          z-index: 2;
        }
        .v2-np-artwork-wrap.is-playing .v2-vinyl-disc {
          animation-play-state: running;
        }
        @keyframes v2-vinyl-spin {
          100% { transform: rotate(360deg); }
        }

        .v2-np-meta {
          width: 100%; max-width: 500px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .v2-np-meta-text { flex: 1; min-width: 0; }
        .v2-np-track-title {
          font-size: 1.75rem; font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .v2-np-track-artist {
          font-size: 1rem; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Progress */
        .v2-np-progress-row {
          width: 100%; max-width: 500px;
          display: flex; align-items: center; gap: 12px;
        }
        .v2-np-time {
          font-size: 0.75rem; color: var(--text-tertiary);
          font-variant-numeric: tabular-nums; width: 36px; text-align: center;
        }
        .v2-np-seek-bar {
          flex: 1; height: 20px; display: flex; align-items: center; cursor: pointer;
        }
        .v2-np-seek-track {
          width: 100%; height: 4px; background: rgba(255,255,255,0.12);
          border-radius: 2px; position: relative;
          transition: height 0.15s ease;
        }
        .v2-np-seek-bar:hover .v2-np-seek-track { height: 6px; }
        .v2-np-seek-fill {
          height: 100%; background: var(--accent-gradient);
          border-radius: 2px; position: relative;
        }
        .v2-np-seek-thumb {
          position: absolute; right: -6px; top: 50%;
          transform: translateY(-50%) scale(0);
          width: 14px; height: 14px; background: white; border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          transition: transform 0.15s ease;
        }
        .v2-np-seek-bar:hover .v2-np-seek-thumb { transform: translateY(-50%) scale(1); }

        /* Controls */
        .v2-np-controls {
          display: flex; align-items: center; gap: 24px;
        }
        .v2-control-btn {
          background: none; border: none; color: var(--text-primary); cursor: pointer;
          transition: all 0.15s ease; padding: 8px; border-radius: 50%;
        }
        .v2-control-btn:hover { color: var(--accent-primary); transform: scale(1.1); }
        .v2-control-secondary {
          background: none; border: none; color: var(--text-tertiary); cursor: pointer;
          transition: all 0.15s ease; padding: 8px; border-radius: 50%;
        }
        .v2-control-secondary:hover { color: var(--text-primary); }
        .v2-control-secondary.active { color: var(--accent-primary); }
        .v2-np-play-btn {
          width: 64px; height: 64px; border-radius: 50%;
          background: white; color: black; border: none;
          display: grid; place-items: center; cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .v2-np-play-btn:hover { transform: scale(1.06); box-shadow: 0 12px 32px rgba(0,0,0,0.5); }

        /* Volume */
        .v2-np-volume {
          display: flex; align-items: center; gap: 12px;
          width: 100%; max-width: 280px;
        }
        .v2-volume-slider {
          flex: 1; height: 4px; -webkit-appearance: none; appearance: none;
          background: rgba(255,255,255,0.15); border-radius: 2px; outline: none;
          cursor: pointer;
        }
        .v2-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 50%; background: white; cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }

        /* Right panel */
        .v2-np-panel {
          width: 340px;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: inset 0 0 40px rgba(255,255,255,0.01), 0 16px 40px rgba(0,0,0,0.5);
        }
        .v2-np-tabs {
          display: flex; gap: 4px;
          padding: 16px 16px 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .v2-np-tab {
          padding: 10px 16px; border-radius: 8px 8px 0 0;
          background: none; border: none; color: var(--text-secondary);
          font-weight: 700; font-size: 0.875rem; cursor: pointer;
          transition: 0.15s; border-bottom: 2px solid transparent;
        }
        .v2-np-tab:hover { color: var(--text-primary); }
        .v2-np-tab.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent-primary);
          text-shadow: 0 0 12px rgba(255,255,255,0.2);
        }
        .v2-np-panel-body {
          flex: 1; overflow-y: auto; padding: 16px;
        }
        .v2-np-panel-body::-webkit-scrollbar { width: 4px; }
        .v2-np-panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

        .v2-np-queue-heading {
          font-size: 0.625rem; letter-spacing: 0.15em; color: var(--text-tertiary);
          font-weight: 700; margin-bottom: 12px;
        }
        .v2-np-queue { display: flex; flex-direction: column; gap: 4px; }
        .v2-np-queue-item {
          display: flex; align-items: center; gap: 12px;
          padding: 8px; border-radius: 10px;
          transition: background 0.15s; cursor: pointer;
        }
        .v2-np-queue-item:hover { background: rgba(255,255,255,0.05); }
        .v2-np-queue-item.active { background: rgba(255,255,255,0.08); }
        .v2-np-queue-art {
          width: 44px; height: 44px; border-radius: 8px;
          object-fit: cover; flex-shrink: 0;
        }
        .v2-np-queue-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .v2-np-queue-meta strong {
          font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          color: var(--text-primary);
        }
        .v2-np-queue-meta small {
          font-size: 0.75rem; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .v2-np-playing-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--accent-primary); flex-shrink: 0;
          animation: v2-pulse 1.5s ease-in-out infinite;
        }
        @keyframes v2-pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .v2-np-fullscreen {
            left: 0;
          }
          .v2-np-body {
            flex-direction: column;
            padding: 0 24px 24px;
            overflow-y: auto;
          }
          .v2-np-panel {
            width: 100%;
            flex-shrink: 0;
            max-height: 320px;
          }
          .v2-np-artwork-wrap {
            max-width: 280px;
          }
        }
        @media (max-width: 768px) {
          .v2-np-fullscreen {
            top: 0;
            bottom: calc(var(--mobile-nav-height) + var(--player-height));
          }
          .v2-np-topbar { padding: 12px 16px; }
          .v2-np-body { padding: 0 16px 16px; gap: 24px; }
          .v2-np-artwork-wrap { max-width: 240px; }
          .v2-np-track-title { font-size: 1.375rem; }
        }
      `}</style>
    </div>
  )
}

// ─── Mini Global Player bar ─────────────────────────────────────────────────
export default function GlobalPlayer() {
  const {
    activeItem, isPlaying, togglePlay, error,
    volume, setVolume,
    currentTime, duration, seek,
    queue, currentIndex,
    shuffle, setShuffle, repeat, setRepeat,
    handleNext, handlePrev,
  } = useAudio()

  const { favorites, toggleFavorite } = useLibrary()
  const liked = favorites.some(x => mediaKey(x) === mediaKey(activeItem))
  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [muted, setMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(1)

  const artworkUrl = activeItem?.image_url || activeItem?.cover_url || activeItem?.image
  const progress   = duration > 0 ? (currentTime / duration) * 100 : 0

  const toggleMute = useCallback(() => {
    if (volume === 0) {
      setVolume(prevVolume || 0.8)
      setMuted(false)
    } else {
      setPrevVolume(volume)
      setVolume(0)
      setMuted(true)
    }
  }, [muted, volume, prevVolume, setVolume])

  // Don't render if nothing to play
  if (!activeItem) return null

  return (
    <>
      {/* Now Playing overlay */}
      {(showNowPlaying || isClosing) && (
        <NowPlaying
          isClosing={isClosing}
          onClose={() => {
            setIsClosing(true)
            setTimeout(() => {
              setShowNowPlaying(false)
              setIsClosing(false)
            }, 300)
          }}
          activeItem={activeItem}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          currentTime={currentTime}
          duration={duration}
          seek={seek}
          volume={volume}
          setVolume={setVolume}
          handleNext={handleNext}
          handlePrev={handlePrev}
          shuffle={shuffle} setShuffle={setShuffle}
          repeat={repeat}  setRepeat={setRepeat}
          queue={queue}
          currentIndex={currentIndex}
        />
      )}

      {/* Mini player bar */}
      <div className="v2-player-bar" onClick={(e) => {
        // On mobile, clicking the bar opens Now Playing (unless clicking a button)
        if (window.innerWidth <= 768 && !e.target.closest('button') && !e.target.closest('.v2-player-progress-strip')) {
          setShowNowPlaying(true)
        }
      }}>
        {error && <div role="alert" className="v2-player-error">{error}</div>}
        
        {/* Mobile only progress strip */}
        <div
          className="v2-player-progress-strip v2-mobile-only"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek(((e.clientX - rect.left) / rect.width) * duration)
          }}
        >
          <div className="v2-player-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="v2-player-inner">
          {/* Left: track info */}
          <div className="v2-player-info">
            <div
              className="v2-player-art"
              onClick={() => setShowNowPlaying(true)}
              title="Open Now Playing"
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setShowNowPlaying(true)}
            >
              {artworkUrl && <img src={artworkUrl} alt="" />}
              <div className="v2-player-art-hover v2-desktop-only"><Maximize2 size={14} /></div>
            </div>
            <div className="v2-player-track-text">
              <strong>{activeItem.title}</strong>
              <small>{activeItem.artist || activeItem.author}</small>
            </div>
            <button className="v2-icon-btn v2-desktop-only" title={liked ? 'Remove favorite' : 'Favorite'} aria-pressed={liked} onClick={() => toggleFavorite(activeItem)} style={{ flexShrink: 0 }}>
              <Heart size={16} className={liked ? "v2-liked" : ""} />
            </button>
          </div>

          {/* Center: controls + time */}
          <div className="v2-player-center">
            <div className="v2-player-controls">
              <button
                className={`v2-ctrl-secondary v2-desktop-only ${shuffle ? 'on' : ''}`}
                onClick={() => setShuffle(s => !s)}
                title="Shuffle"
              >
                <Shuffle size={16} />
              </button>
              <button className="v2-ctrl-btn v2-desktop-only" onClick={handlePrev} title="Previous">
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button className="v2-ctrl-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <Pause size={20} fill="currentColor" />
                  : <Play  size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
                }
              </button>
              <button className="v2-ctrl-btn v2-desktop-only" onClick={() => handleNext(false)} title="Next">
                <SkipForward size={20} fill="currentColor" />
              </button>
              <button
                className={`v2-ctrl-secondary v2-desktop-only ${repeat !== 'none' ? 'on' : ''}`}
                onClick={() => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            </div>
            <div className="v2-player-time-row v2-desktop-only">
              <span className="v2-player-time">{formatTime(currentTime)}</span>
              <div
                className="v2-player-seek" role="slider" tabIndex={0} aria-label="Playback position" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={currentTime} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek(currentTime + (e.key === 'ArrowRight' ? 5 : -5)) } }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  seek(((e.clientX - rect.left) / rect.width) * duration)
                }}
              >
                <div className="v2-player-seek-track">
                  <div className="v2-player-seek-fill" style={{ width: `${progress}%` }}>
                    <div className="v2-player-seek-thumb" />
                  </div>
                </div>
              </div>
              <span className="v2-player-time">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: volume + expand */}
          <div className="v2-player-right v2-desktop-only">
            <button className="v2-icon-btn" onClick={() => setShowNowPlaying(true)} title="Queue">
              <ListMusic size={18} />
            </button>
            <div className="v2-volume-row">
              <button className="v2-icon-btn" onClick={toggleMute} title={volume === 0 ? 'Unmute' : 'Mute'}>
                {(volume === 0)
                  ? <VolumeX size={18} />
                  : <Volume2  size={18} />
                }
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={volume}
                onChange={e => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                className="v2-volume-slider"
                aria-label="Volume"
              />
            </div>
            <button className="v2-icon-btn" onClick={() => setShowNowPlaying(true)} title="Fullscreen">
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Mini player bar ── */
        .v2-player-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: var(--player-height);
          z-index: 50;
          display: flex;
          flex-direction: column;
          background: rgba(11, 11, 22, 0.85);
          backdrop-filter: blur(40px) saturate(1.5);
          -webkit-backdrop-filter: blur(40px) saturate(1.5);
          border-top: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .v2-player-error {
          position: absolute;
          top: -32px;
          left: 50%;
          transform: translateX(-50%);
          background: #e74c3c;
          color: white;
          padding: 4px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .v2-mobile-only {
          display: none;
        }

        .v2-player-progress-strip {
          width: 100%;
          height: 2px;
          background: rgba(255,255,255,0.08);
          cursor: pointer;
          flex-shrink: 0;
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 8px 8px 0 0;
          overflow: hidden;
        }
        .v2-player-progress-fill {
          height: 100%;
          background: var(--accent-gradient);
          transition: width 0.15s linear;
          border-radius: 8px 0 0 0;
        }

        .v2-player-inner {
          flex: 1;
          display: grid;
          grid-template-columns: 30% 40% 30%;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
          height: 100%;
        }

        /* Track info */
        .v2-player-info {
          display: flex; align-items: center; gap: 14px;
          min-width: 0;
        }
        .v2-player-art {
          width: 56px; height: 56px;
          border-radius: 6px; overflow: hidden;
          position: relative; flex-shrink: 0;
          cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          transition: transform 0.2s ease;
        }
        .v2-player-art:hover {
          transform: scale(1.05);
        }
        .v2-player-art img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .v2-player-art-hover {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.6);
          display: grid; place-items: center;
          color: white; opacity: 0;
          transition: opacity 0.2s;
        }
        .v2-player-art:hover .v2-player-art-hover { opacity: 1; }
        .v2-player-track-text {
          display: flex; flex-direction: column; gap: 3px;
          min-width: 0;
        }
        .v2-player-track-text strong {
          font-size: 0.95rem; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          color: var(--text-primary);
        }
        .v2-player-track-text small {
          font-size: 0.8rem; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .v2-liked {
          color: var(--accent-primary);
          fill: var(--accent-primary);
        }

        /* Center */
        .v2-player-center {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 8px;
          max-width: 722px;
          width: 100%;
          margin: 0 auto;
        }
        .v2-player-controls {
          display: flex; align-items: center; gap: 16px;
        }
        .v2-ctrl-btn {
          background: none; border: none; color: var(--text-primary);
          cursor: pointer; padding: 8px; border-radius: 50%;
          transition: all 0.2s ease; display: grid; place-items: center;
          opacity: 0.7;
        }
        .v2-ctrl-btn:hover { opacity: 1; transform: scale(1.1); }
        .v2-ctrl-secondary {
          background: none; border: none; color: var(--text-tertiary);
          cursor: pointer; padding: 8px; border-radius: 50%;
          transition: all 0.2s ease; display: grid; place-items: center;
        }
        .v2-ctrl-secondary:hover { color: var(--text-primary); }
        .v2-ctrl-secondary.on { color: var(--accent-primary); opacity: 1; }
        .v2-ctrl-play {
          width: 32px; height: 32px; border-radius: 50%;
          background: white; color: black; border: none;
          display: grid; place-items: center; cursor: pointer;
          transition: transform 0.2s ease, background 0.2s ease; flex-shrink: 0;
        }
        .v2-ctrl-play:hover { transform: scale(1.08); background: #f0f0f0; }

        /* Seek row */
        .v2-player-time-row {
          display: flex; align-items: center; gap: 8px; width: 100%;
        }
        .v2-player-time {
          font-size: 0.7rem; color: var(--text-tertiary);
          font-variant-numeric: tabular-nums; width: 40px; text-align: center;
        }
        .v2-player-seek {
          flex: 1; height: 12px; display: flex; align-items: center; cursor: pointer;
        }
        .v2-player-seek-track {
          width: 100%; height: 4px; background: rgba(255,255,255,0.1);
          border-radius: 2px; position: relative;
          transition: background 0.2s ease;
        }
        .v2-player-seek:hover .v2-player-seek-track { background: rgba(255,255,255,0.15); }
        .v2-player-seek-fill {
          height: 100%; background: var(--text-primary);
          border-radius: 2px; position: relative;
          transition: background 0.2s ease;
        }
        .v2-player-seek:hover .v2-player-seek-fill { background: var(--accent-gradient); }
        .v2-player-seek-thumb {
          position: absolute; right: -6px; top: 50%;
          transform: translateY(-50%) scale(0);
          width: 12px; height: 12px; border-radius: 50%;
          background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .v2-player-seek:hover .v2-player-seek-thumb { transform: translateY(-50%) scale(1); }

        /* Right */
        .v2-player-right {
          display: flex; align-items: center;
          justify-content: flex-end; gap: 12px;
        }
        .v2-icon-btn {
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; transition: color 0.2s ease, transform 0.2s ease;
          display: grid; place-items: center;
        }
        .v2-icon-btn:hover { color: var(--text-primary); transform: scale(1.1); }
        .v2-volume-row {
          display: flex; align-items: center; gap: 6px;
        }
        .v2-volume-slider {
          width: 90px; height: 4px; -webkit-appearance: none; appearance: none;
          background: rgba(255,255,255,0.15); border-radius: 2px; outline: none; cursor: pointer;
          transition: background 0.2s ease;
        }
        .v2-volume-slider:hover { background: rgba(255,255,255,0.25); }
        .v2-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: white; cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          transition: transform 0.2s ease;
        }
        .v2-volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        /* Mobile overrides */
        @media (max-width: 768px) {
          .v2-desktop-only { display: none !important; }
          .v2-mobile-only { display: block !important; }

          .v2-player-bar {
            height: var(--player-height-mobile);
            padding: 0;
            background: rgba(20, 20, 30, 0.95);
            border-top: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            left: 8px;
            right: 8px;
            bottom: calc(var(--mobile-nav-height) + 8px);
          }
          .v2-player-inner {
            grid-template-columns: 1fr auto;
            padding: 0 12px;
            gap: 12px;
          }
          .v2-player-info { gap: 10px; }
          .v2-player-art { width: 44px; height: 44px; border-radius: 4px; }
          .v2-player-center { max-width: none; margin: 0; justify-content: center; }
          .v2-ctrl-play { width: 32px; height: 32px; background: transparent; color: white; box-shadow: none; }
          .v2-ctrl-play:hover { background: transparent; transform: scale(1.1); color: var(--accent-primary); }
        }
      `}</style>
    </>
  )
}
