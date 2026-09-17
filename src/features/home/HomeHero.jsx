import React, { useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shuffle, Compass, Music2, Users, Radio, Music, Sun, Moon } from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'
import { mediaProvider } from '../../services/media'
import './HomeHero.css'

export default function HomeHero({ tracks = [] }) {
  const navigate = useNavigate()
  const { activeItem, isPlaying, playItem, setShuffle } = useAudio()
  const heroRef = useRef(null)
  const rafRef = useRef(null)

  // Dynamic greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return 'Good Morning'
    if (hour >= 12 && hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }, [])

  // Real statistics derived from tracks
  const tracksCount = tracks.length

  const artistsCount = useMemo(() => {
    return new Set(tracks.map(t => t.artist || t.author).filter(Boolean)).size
  }, [tracks])

  const totalDurationFormatted = useMemo(() => {
    const totalSeconds = tracks.reduce((acc, t) => {
      const sec = Number(t.duration) || 0
      return acc + (Number.isFinite(sec) && sec > 0 ? sec : 0)
    }, 0)

    if (!totalSeconds) return '—'
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }, [tracks])

  // Current or featured artwork
  const currentArtwork = useMemo(() => {
    return mediaProvider.getArtworkUrl(
      activeItem?.image_url ||
      activeItem?.cover_url ||
      activeItem?.image ||
      tracks[0]?.image_url ||
      tracks[0]?.cover_url ||
      '/icons/icon.svg'
    )
  }, [activeItem, tracks])

  // Real shuffle / random playback
  const handleRandomPlay = () => {
    if (!tracks.length) return
    const index = Math.floor(Math.random() * tracks.length)
    setShuffle(true)
    playItem(tracks[index], tracks, index)
  }

  // Desktop-only micro-parallax (<6px) throttled via requestAnimationFrame
  const handlePointerMove = (e) => {
    if (window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches || window.innerWidth <= 1024) return
    const el = heroRef.current
    if (!el) return

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const relX = (e.clientX - rect.left) / rect.width - 0.5
      const relY = (e.clientY - rect.top) / rect.height - 0.5
      const clampX = Math.max(-6, Math.min(6, relX * 12))
      const clampY = Math.max(-6, Math.min(6, relY * 12))
      el.style.setProperty('--home-shift-x', `${clampX.toFixed(1)}px`)
      el.style.setProperty('--home-shift-y', `${clampY.toFixed(1)}px`)
    })
  }

  const handlePointerLeave = () => {
    const el = heroRef.current
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    el.style.setProperty('--home-shift-x', '0px')
    el.style.setProperty('--home-shift-y', '0px')
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="v2-home-hero home-hero"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Static Cosmic Space Background */}
      <div className="home-cosmic-bg" aria-hidden="true">
        <div className="home-nebula-blue" />
        <div className="home-nebula-purple" />
        <div className="home-cosmic-dust" />
        <div className="home-shooting-star" />
      </div>

      {/* Ambient Artwork Glow (inherits from current song) */}
      <div
        className="home-ambient-glow"
        style={{ backgroundImage: `url(${currentArtwork})` }}
        aria-hidden="true"
      />

      {/* Left Column: Greeting, Headline, Subtitle, Actions, Stats */}
      <div className="home-hero-left">
        <div className="home-greeting-badge">
          {greeting === 'Good Evening' ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
          <span>{greeting}</span>
        </div>

        <h1 className="home-hero-headline">
          <span className="headline-line">Âm nhạc và</span>
          <span className="headline-gradient">những câu chuyện,</span>
          <span className="headline-line">ở cùng một nơi.</span>
        </h1>

        <p className="home-hero-sub">
          Khám phá thế giới âm thanh theo cách của bạn.
          <br className="sub-break" /> Mỗi bài hát là một câu chuyện. Mỗi câu chuyện là một hành trình.
        </p>

        <div className="home-hero-actions">
          <button
            className="v2-btn-primary home-btn-play"
            disabled={!tracks.length}
            onClick={handleRandomPlay}
            aria-label="Phát ngẫu nhiên bài hát"
          >
            <Shuffle size={18} className="btn-icon" />
            <span>Phát ngẫu nhiên</span>
          </button>

          <button
            className="v2-btn-secondary home-btn-explore"
            onClick={() => navigate('/music')}
            aria-label="Khám phá ngay thư viện bài hát"
          >
            <Compass size={18} className="btn-icon" />
            <span>Khám phá ngay</span>
          </button>
        </div>

      </div>

      {/* Right Column: 3D Cinematic Music Installation */}
      <div className="home-hero-right" aria-hidden="true">
        <div className="home-music-stage">
          {/* Cosmic orbital rings */}
          <div className="home-orbit-ring ring-outer" />
          <div className="home-orbit-ring ring-mid">
            <div className="orbit-sphere sphere-cyan" />
          </div>
          <div className="home-orbit-ring ring-inner">
            <div className="orbit-sphere sphere-purple" />
          </div>

          {/* Floating musical notes */}
          <div className="floating-note note-1">
            <Music size={18} />
          </div>
          <div className="floating-note note-2">
            <Music2 size={22} />
          </div>
          <div className="floating-note note-3">
            <Music size={14} />
          </div>

          {/* Hand-written visual signature */}
          <div className="home-handwritten-signature">
            <span>Music</span>
            <span>Heals</span>
            <span>Everything</span>
          </div>

          {/* Vinyl record behind the artwork */}
          <div className={`home-vinyl ${isPlaying ? 'is-spinning' : 'is-paused'}`}>
            <div className="vinyl-grooves" />
            <div className="vinyl-label">
              <div
                className="vinyl-cover-thumb"
                style={{ backgroundImage: `url(${currentArtwork})` }}
              />
              <div className="vinyl-spindle" />
            </div>
          </div>

          {/* Central Artwork Glass Frame */}
          <div className="home-artwork-frame">
            <div className="artwork-glass-reflection" />
            <div className="artwork-light-sweep" />
            <img
              src={currentArtwork}
              alt=""
              className="artwork-image"
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/icons/icon.svg' }}
              loading="eager" decoding="async"
            />
          </div>

          {/* Premium Vector Headphones (Front / Left) */}
          <div className="home-headphones-overlay">
            <svg
              className="headphones-svg"
              viewBox="0 0 240 240"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="hpHeadband" x1="40" y1="20" x2="200" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="hpCupLeft" x1="20" y1="90" x2="60" y2="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
                <linearGradient id="hpCupRight" x1="180" y1="90" x2="220" y2="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
                <filter id="hpGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#38bdf8" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Headband arch */}
              <path
                d="M 46 128 C 46 55, 194 55, 194 128"
                stroke="url(#hpHeadband)"
                strokeWidth="10"
                strokeLinecap="round"
                filter="url(#hpGlow)"
              />
              <path
                d="M 52 120 C 52 64, 188 64, 188 120"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Left Earcup */}
              <g transform="rotate(8 42 142)">
                <rect x="22" y="110" width="36" height="66" rx="18" fill="url(#hpCupLeft)" stroke="#38bdf8" strokeWidth="2" />
                <rect x="18" y="118" width="10" height="50" rx="5" fill="#090d16" stroke="rgba(56,189,248,0.4)" strokeWidth="1" />
                <circle cx="40" cy="143" r="8" fill="#38bdf8" opacity="0.8" />
              </g>

              {/* Right Earcup */}
              <g transform="rotate(-8 198 142)">
                <rect x="182" y="110" width="36" height="66" rx="18" fill="url(#hpCupRight)" stroke="#c084fc" strokeWidth="2" />
                <rect x="212" y="118" width="10" height="50" rx="5" fill="#090d16" stroke="rgba(192,132,252,0.4)" strokeWidth="1" />
                <circle cx="200" cy="143" r="8" fill="#c084fc" opacity="0.8" />
              </g>
            </svg>
          </div>

          <div className="home-platform-base" />
          {/* SoundVerse Identity */}
          <div className="home-identity-tag">
            <span className="tag-brand">SOUNDVERSE</span>
            <span className="tag-motto">YOUR SOUND. YOUR UNIVERSE.</span>
          </div>
        </div>
      </div>
        {/* 3 Real Music Statistics */}
        <div className="home-hero-stats" role="region" aria-label="Thống kê âm nhạc">
          <div className="home-stat-item stat-tracks">
            <div className="stat-icon-badge" aria-hidden="true">
              <Music2 size={18} />
            </div>
            <div className="stat-content">
              <strong className="stat-value">{tracksCount}</strong>
              <span className="stat-title">BÀI HÁT</span>
              <small className="stat-desc">đang chờ bạn khám phá</small>
            </div>
          </div>

          <div className="stat-divider" aria-hidden="true" />

          <div className="home-stat-item stat-artists">
            <div className="stat-icon-badge" aria-hidden="true">
              <Users size={18} />
            </div>
            <div className="stat-content">
              <strong className="stat-value">{artistsCount}</strong>
              <span className="stat-title">NGHỆ SĨ</span>
              <small className="stat-desc">với những màu sắc riêng</small>
            </div>
          </div>

          <div className="stat-divider" aria-hidden="true" />

          <div className="home-stat-item stat-duration">
            <div className="stat-icon-badge" aria-hidden="true">
              <Radio size={18} />
            </div>
            <div className="stat-content">
              <strong className="stat-value">{totalDurationFormatted}</strong>
              <span className="stat-title">TỔNG THỜI LƯỢNG</span>
              <small className="stat-desc">trong thư viện của bạn</small>
            </div>
          </div>
        </div>
    </section>
  )
}
