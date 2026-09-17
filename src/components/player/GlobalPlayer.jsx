import { mediaProvider } from '../../services/media'
import React, { useState, useCallback, useRef, useMemo } from 'react'
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
import './GlobalPlayer.css'
import SyncedLyrics, { parseSyncedLyrics } from './SyncedLyrics'

// ─── helpers ───────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || isNaN(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

import NowPlayingOverlay from './NowPlayingOverlay'

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

  const artworkUrl = useMemo(() => {
    return mediaProvider.getArtworkUrl(activeItem?.image_url || activeItem?.cover_url || activeItem?.image)
  }, [activeItem?.image_url, activeItem?.cover_url, activeItem?.image, activeItem?.id])
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
        <NowPlayingOverlay
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
      <div className="v2-player-bar" style={showNowPlaying || isClosing ? { display: 'none' } : undefined} onClick={(e) => {
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
    </>
  )
}
