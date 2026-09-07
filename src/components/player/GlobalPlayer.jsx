import React, { useState, useCallback } from 'react'
import {
  Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, ListMusic, Shuffle, Repeat, Repeat1,
  Heart, Maximize2, ChevronDown, MoreHorizontal, X
} from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'

// ─── helpers ───────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ─── Now Playing fullscreen overlay ────────────────────────────────────────
function NowPlaying({ onClose, activeItem, isPlaying, togglePlay,
  currentTime, duration, seek, volume, setVolume,
  handleNext, handlePrev, shuffle, setShuffle, repeat, setRepeat, queue, currentIndex }) {

  const [activeTab, setActiveTab] = useState('queue')
  const artworkUrl = activeItem?.image_url || activeItem?.cover_url || activeItem?.image
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const repeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div className="v2-np-fullscreen">
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
            <span className="v2-np-context-label">NOW PLAYING</span>
          </div>
          <button className="v2-icon-btn" title="More options">
            <MoreHorizontal size={20} />
          </button>
        </header>

        {/* Main body: artwork + controls on left, panel on right */}
        <div className="v2-np-body">
          {/* Left/Center: artwork + controls */}
          <div className="v2-np-main">
            <div className="v2-np-artwork-wrap">
              <img src={artworkUrl} alt={activeItem?.title ?? ''} className="v2-np-artwork-img" />
            </div>

            <div className="v2-np-meta">
              <div className="v2-np-meta-text">
                <h2 className="v2-np-track-title">{activeItem?.title}</h2>
                <p  className="v2-np-track-artist">{activeItem?.artist || activeItem?.author}</p>
              </div>
              <button className="v2-icon-btn" title="Like">
                <Heart size={20} />
              </button>
            </div>

            {/* Progress */}
            <div className="v2-np-progress-row">
              <span className="v2-np-time">{formatTime(currentTime)}</span>
              <div
                className="v2-np-seek-bar"
                role="slider"
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
                <repeatIcon size={20} />
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
                        <img src={art} alt="" className="v2-np-queue-art" />
                        <div className="v2-np-queue-meta">
                          <strong>{item.title}</strong>
                          <small>{item.artist || item.author}</small>
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
                    No lyrics available
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
          position: fixed;
          /* Respect sidebar and topbar on desktop */
          top: var(--topbar-height);
          left: var(--sidebar-width);
          right: 0;
          bottom: var(--player-height);
          z-index: 40;
          overflow: hidden;
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
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          min-width: 0;
        }

        .v2-np-artwork-wrap {
          width: 100%;
          max-width: 420px;
          aspect-ratio: 1;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7);
          flex-shrink: 1;
        }
        .v2-np-artwork-img {
          width: 100%; height: 100%;
          object-fit: cover;
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
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
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
            bottom: var(--mobile-nav-height);
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
    activeItem, isPlaying, togglePlay,
    volume, setVolume,
    currentTime, duration, seek,
    queue, currentIndex,
    shuffle, setShuffle, repeat, setRepeat,
    handleNext, handlePrev,
  } = useAudio()

  const [showNowPlaying, setShowNowPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(1)

  const artworkUrl = activeItem?.image_url || activeItem?.cover_url || activeItem?.image
  const progress   = duration > 0 ? (currentTime / duration) * 100 : 0

  const toggleMute = useCallback(() => {
    if (muted) {
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
      {showNowPlaying && (
        <NowPlaying
          onClose={() => setShowNowPlaying(false)}
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
      <div className="v2-player-bar">
        {/* Progress bar at very top of player */}
        <div
          className="v2-player-progress-strip"
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
              <div className="v2-player-art-hover"><Maximize2 size={14} /></div>
            </div>
            <div className="v2-player-track-text">
              <strong>{activeItem.title}</strong>
              <small>{activeItem.artist || activeItem.author}</small>
            </div>
            <button className="v2-icon-btn" title="Like" style={{ flexShrink: 0 }}>
              <Heart size={16} />
            </button>
          </div>

          {/* Center: controls + time */}
          <div className="v2-player-center">
            <div className="v2-player-controls">
              <button
                className={`v2-ctrl-secondary ${shuffle ? 'on' : ''}`}
                onClick={() => setShuffle(s => !s)}
                title="Shuffle"
              >
                <Shuffle size={16} />
              </button>
              <button className="v2-ctrl-btn" onClick={handlePrev} title="Previous">
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button className="v2-ctrl-play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying
                  ? <Pause size={20} fill="currentColor" />
                  : <Play  size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
                }
              </button>
              <button className="v2-ctrl-btn" onClick={() => handleNext(false)} title="Next">
                <SkipForward size={20} fill="currentColor" />
              </button>
              <button
                className={`v2-ctrl-secondary ${repeat !== 'none' ? 'on' : ''}`}
                onClick={() => setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none')}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            </div>
            <div className="v2-player-time-row">
              <span className="v2-player-time">{formatTime(currentTime)}</span>
              <div
                className="v2-player-seek"
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
          <div className="v2-player-right">
            <button className="v2-icon-btn" onClick={() => setShowNowPlaying(true)} title="Open Now Playing">
              <ListMusic size={18} />
            </button>
            <div className="v2-volume-row">
              <button className="v2-icon-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                {(muted || volume === 0)
                  ? <VolumeX size={18} />
                  : <Volume2  size={18} />
                }
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={muted ? 0 : volume}
                onChange={e => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                className="v2-volume-slider"
                aria-label="Volume"
              />
            </div>
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
          background: rgba(11, 11, 22, 0.96);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .v2-player-progress-strip {
          width: 100%;
          height: 3px;
          background: rgba(255,255,255,0.08);
          cursor: pointer;
          flex-shrink: 0;
        }
        .v2-player-progress-fill {
          height: 100%;
          background: var(--accent-gradient);
          transition: width 0.25s linear;
        }

        .v2-player-inner {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
        }

        /* Track info */
        .v2-player-info {
          display: flex; align-items: center; gap: 12px;
          min-width: 0;
        }
        .v2-player-art {
          width: 52px; height: 52px;
          border-radius: 10px; overflow: hidden;
          position: relative; flex-shrink: 0;
          cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }
        .v2-player-art img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .v2-player-art-hover {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.55);
          display: grid; place-items: center;
          color: white; opacity: 0;
          transition: opacity 0.15s;
        }
        .v2-player-art:hover .v2-player-art-hover { opacity: 1; }
        .v2-player-track-text {
          display: flex; flex-direction: column; gap: 2px;
          min-width: 0; flex: 1;
        }
        .v2-player-track-text strong {
          font-size: 0.9rem; font-weight: 700;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          color: var(--text-primary);
        }
        .v2-player-track-text small {
          font-size: 0.78rem; color: var(--text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Center */
        .v2-player-center {
          display: flex; flex-direction: column;
          align-items: center; gap: 6px;
        }
        .v2-player-controls {
          display: flex; align-items: center; gap: 8px;
        }
        .v2-ctrl-btn {
          background: none; border: none; color: var(--text-primary);
          cursor: pointer; padding: 8px; border-radius: 50%;
          transition: all 0.15s; display: grid; place-items: center;
        }
        .v2-ctrl-btn:hover { color: var(--accent-primary); transform: scale(1.1); }
        .v2-ctrl-secondary {
          background: none; border: none; color: var(--text-tertiary);
          cursor: pointer; padding: 8px; border-radius: 50%;
          transition: all 0.15s; display: grid; place-items: center;
        }
        .v2-ctrl-secondary:hover { color: var(--text-primary); }
        .v2-ctrl-secondary.on { color: var(--accent-primary); }
        .v2-ctrl-play {
          width: 38px; height: 38px; border-radius: 50%;
          background: white; color: black; border: none;
          display: grid; place-items: center; cursor: pointer;
          transition: transform 0.15s; flex-shrink: 0;
        }
        .v2-ctrl-play:hover { transform: scale(1.06); }

        /* Seek row */
        .v2-player-time-row {
          display: flex; align-items: center; gap: 8px; width: 100%;
        }
        .v2-player-time {
          font-size: 0.625rem; color: var(--text-tertiary);
          font-variant-numeric: tabular-nums; width: 32px; text-align: center;
        }
        .v2-player-seek {
          flex: 1; height: 16px; display: flex; align-items: center; cursor: pointer;
        }
        .v2-player-seek-track {
          width: 100%; height: 3px; background: rgba(255,255,255,0.1);
          border-radius: 2px; position: relative;
          transition: height 0.12s ease;
        }
        .v2-player-seek:hover .v2-player-seek-track { height: 5px; }
        .v2-player-seek-fill {
          height: 100%; background: var(--accent-gradient);
          border-radius: 2px; position: relative;
        }
        .v2-player-seek-thumb {
          position: absolute; right: -5px; top: 50%;
          transform: translateY(-50%) scale(0);
          width: 12px; height: 12px; border-radius: 50%;
          background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          transition: transform 0.12s ease;
        }
        .v2-player-seek:hover .v2-player-seek-thumb { transform: translateY(-50%) scale(1); }

        /* Right */
        .v2-player-right {
          display: flex; align-items: center;
          justify-content: flex-end; gap: 8px;
        }
        .v2-volume-row {
          display: flex; align-items: center; gap: 4px;
        }
        .v2-volume-slider {
          width: 80px; height: 4px; -webkit-appearance: none; appearance: none;
          background: rgba(255,255,255,0.15); border-radius: 2px; outline: none; cursor: pointer;
        }
        .v2-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; background: white; cursor: pointer;
        }

        /* Mobile overrides */
        @media (max-width: 768px) {
          .v2-player-bar {
            /* On mobile, the player sits ABOVE the BottomNav */
            bottom: var(--mobile-nav-height);
          }
          .v2-player-inner {
            grid-template-columns: 1fr auto;
            padding: 0 12px;
            gap: 8px;
          }
          .v2-player-right { display: none; }
          .v2-player-controls { gap: 4px; }
          .v2-player-art { width: 44px; height: 44px; }
        }
      `}</style>
    </>
  )
}
