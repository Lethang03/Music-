import { mediaProvider } from '../../services/media'
import React, { useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Pause, Compass, Mic2, Radio, Clock } from 'lucide-react'
import { useAudio } from '../../contexts/AudioContext'
import './PodcastHero.css'

const FALLBACK_COVER = '/icons/icon.svg'

export default function PodcastHero({ podcasts = [], episodes = [] }) {
  const navigate = useNavigate()
  const { activeItem, isPlaying, playItem, togglePlay } = useAudio()
  const heroRef = useRef(null)
  const rafRef = useRef(null)

  // Real statistics derived from podcasts and episodes
  const podcastsCount = podcasts.length

  const episodesCount = useMemo(() => {
    if (episodes.length > 0) return episodes.length
    return podcasts.reduce((acc, p) => acc + (Number(p.episode_count) || 0), 0)
  }, [episodes, podcasts])

  const totalDurationFormatted = useMemo(() => {
    const totalSeconds = episodes.reduce((acc, ep) => {
      const sec = Number(ep.duration) || 0
      return acc + (Number.isFinite(sec) && sec > 0 ? sec : 0)
    }, 0)

    if (totalSeconds > 0) {
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }

    return episodesCount ? '—' : '0m'
  }, [episodes, episodesCount])

  // Featured covers from real podcasts
  const coverMain = useMemo(() => mediaProvider.getCoverUrl(podcasts[0]?.image || podcasts[0]?.cover_url || FALLBACK_COVER), [podcasts])
  const coverLeft = useMemo(() => mediaProvider.getCoverUrl(podcasts[1]?.image || podcasts[1]?.cover_url || coverMain), [podcasts, coverMain])
  const coverRight = useMemo(() => mediaProvider.getCoverUrl(podcasts[2]?.image || podcasts[2]?.cover_url || coverMain), [podcasts, coverMain])

  const isCurrentEpisodePlaying = isPlaying && activeItem?.type === 'episode'

  // Primary CTA: Listen to featured episode or toggle if already active
  const handleListenNow = () => {
    if (activeItem?.type === 'episode') {
      togglePlay()
      return
    }

    if (episodes.length > 0) {
      const firstEp = episodes[0]
      const parentPod = podcasts.find(p => p.id === firstEp.podcast_id) || podcasts[0]
      const queue = episodes.map(ep => {
        const pod = podcasts.find(p => p.id === ep.podcast_id) || parentPod
        return {
          ...ep,
          audio_url: ep.audio_url,
          image_url: ep.cover_url || ep.image || pod?.image || pod?.cover_url,
          cover_url: ep.cover_url || ep.image || pod?.image || pod?.cover_url,
          artist: pod?.author || ep.author || 'SoundVerse Creator',
          album: pod?.title || 'SoundVerse Podcast',
          type: 'episode',
        }
      })
      playItem(queue[0], queue, 0)
      return
    }

    if (podcasts.length > 0) {
      navigate(`/podcasts/${podcasts[0].id}`)
      return
    }

    const catalogEl = document.getElementById('podcast-catalog')
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleExploreClick = () => {
    const catalogEl = document.getElementById('podcast-catalog')
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' })
    } else {
      window.scrollBy({ top: 480, behavior: 'smooth' })
    }
  }

  // Micro-parallax on pointer move (throttled via requestAnimationFrame)
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
      el.style.setProperty('--pod-shift-x', `${clampX.toFixed(1)}px`)
      el.style.setProperty('--pod-shift-y', `${clampY.toFixed(1)}px`)
    })
  }

  const handlePointerLeave = () => {
    const el = heroRef.current
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    el.style.setProperty('--pod-shift-x', '0px')
    el.style.setProperty('--pod-shift-y', '0px')
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="v2-podcast-hero podcast-hero"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Static Warm Cosmic Ambience */}
      <div className="podcast-cosmic-bg" aria-hidden="true">
        <div className="podcast-nebula-amber" />
        <div className="podcast-nebula-indigo" />
        <div className="podcast-cosmic-dust" />
        <div className="podcast-accent-flare" />
      </div>

      {/* Ambient Artwork Glow */}
      <div
        className="podcast-ambient-glow"
        style={{ backgroundImage: `url(${coverMain})` }}
        aria-hidden="true"
      />

      {/* Left Column: Eyebrow, Giant Headline, Paragraph, Actions, Stats */}
      <div className="podcast-hero-left">
        <div className="podcast-eyebrow-badge">
          <span className="eyebrow-dot" aria-hidden="true">●</span>
          <span>STORIES THAT STAY WITH YOU</span>
        </div>

        <h1 className="podcast-hero-headline">
          <span className="podcast-brand-title">
            Podcast<span className="podcast-dot">.</span>
          </span>
          <span className="podcast-sub-title">Những câu chuyện</span>
          <span className="podcast-gradient-title">đáng để lắng nghe.</span>
        </h1>

        <p className="podcast-hero-desc">
          Từ những phút thư giãn đến những câu chuyện khiến bạn nhìn mọi thứ theo một cách khác.
          <br className="podcast-desc-break" /> Mỗi tập là một khoảng thời gian dành riêng cho bạn.
        </p>

        <div className="podcast-hero-actions">
          <button
            className="v2-btn-primary podcast-btn-play"
            onClick={handleListenNow}
            aria-label={isCurrentEpisodePlaying ? 'Tạm dừng nghe podcast' : 'Nghe ngay tập podcast'}
          >
            {isCurrentEpisodePlaying ? (
              <Pause size={18} fill="currentColor" className="btn-icon" />
            ) : (
              <Play size={18} fill="currentColor" className="btn-icon" />
            )}
            <span>{isCurrentEpisodePlaying ? 'Đang phát' : 'Nghe ngay'}</span>
          </button>

          <button
            className="v2-btn-secondary podcast-btn-explore"
            onClick={handleExploreClick}
            aria-label="Khám phá các kênh podcast"
          >
            <Compass size={18} className="btn-icon" />
            <span>Khám phá Podcast</span>
          </button>
        </div>

      </div>

      {/* Right Column: 3D Studio & Podcast Showcase */}
      <div className="podcast-hero-right" aria-hidden="true">
        <div className="podcast-stage">
          {/* Orbital Rings & Star Spheres */}
          <div className="podcast-orbit ring-outer" />
          <div className="podcast-orbit ring-inner">
            <div className="orbit-orb orb-amber" />
            <div className="orbit-orb orb-cyan" />
          </div>

          {/* Stage Platform Base */}
          <div className="podcast-platform-base" />

          {/* Background Tilted Covers */}
          <div className="podcast-cover-card cover-left">
            <img src={coverLeft} alt="" loading="eager" decoding="async" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER }} />
            <div className="cover-glass-tint" />
          </div>

          <div className="podcast-cover-card cover-right">
            <img src={coverRight} alt="" loading="eager" decoding="async" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER }} />
            <div className="cover-glass-tint" />
          </div>

          {/* Main Front Artwork Card */}
          <div className="podcast-cover-card cover-main">
            <div className="main-glass-reflection" />
            <div className="main-light-sweep" />
            <img src={coverMain} alt="" loading="eager" decoding="async" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_COVER }} />
          </div>

          {/* Studio Condenser Microphone SVG */}
          <div className="podcast-mic-container">
            <img className="podcast-mic-image" src="/studio-microphone.webp" alt="" width="480" height="720" decoding="async" />
          </div>

          {/* Reactive Audio Waveform Bars */}
          <div className={`podcast-waveform ${isCurrentEpisodePlaying ? 'is-playing' : 'is-idle'}`}>
            <span className="wave-bar wb-1" />
            <span className="wave-bar wb-2" />
            <span className="wave-bar wb-3" />
            <span className="wave-bar wb-4" />
            <span className="wave-bar wb-5" />
            <span className="wave-bar wb-6" />
            <span className="wave-bar wb-7" />
            <span className="wave-bar wb-8" />
            <span className="wave-bar wb-9" />
            <span className="wave-bar wb-10" />
            <span className="wave-bar wb-11" />
            <span className="wave-bar wb-12" />
            <span className="wave-bar wb-13" />
            <span className="wave-bar wb-14" />
            <span className="wave-bar wb-15" />
            <span className="wave-bar wb-16" />
          </div>

          {/* Artistic Signature */}
          <div className="podcast-signature-quote">
            <span>Good Conversations, Brighter Days</span>
          </div>

          {/* SoundVerse Podcast Tag */}
          <div className="podcast-identity-badge">
            <span className="identity-title">SOUNDVERSE</span>
            <span className="identity-sub">STORIES & VOICES</span>
          </div>
        </div>
      </div>
        {/* 3 Real Statistics */}
        <div className="podcast-hero-stats" role="region" aria-label="Thống kê Podcast">
          <div className="podcast-stat-card stat-shows">
            <div className="stat-icon-wrap" aria-hidden="true">
              <Radio size={18} />
            </div>
            <div className="stat-meta">
              <strong className="stat-num">{podcastsCount}</strong>
              <span className="stat-label">PODCAST</span>
              <small className="stat-caption">chọn lọc chất lượng</small>
            </div>
          </div>

          <div className="podcast-stat-sep" aria-hidden="true" />

          <div className="podcast-stat-card stat-episodes">
            <div className="stat-icon-wrap" aria-hidden="true">
              <Mic2 size={18} />
            </div>
            <div className="stat-meta">
              <strong className="stat-num">{episodesCount}</strong>
              <span className="stat-label">TẬP PODCAST</span>
              <small className="stat-caption">đa dạng chủ đề</small>
            </div>
          </div>

          <div className="podcast-stat-sep" aria-hidden="true" />

          <div className="podcast-stat-card stat-time">
            <div className="stat-icon-wrap" aria-hidden="true">
              <Clock size={18} />
            </div>
            <div className="stat-meta">
              <strong className="stat-num">{totalDurationFormatted}</strong>
              <span className="stat-label">TỔNG THỜI LƯỢNG</span>
              <small className="stat-caption">từ các tập có dữ liệu</small>
            </div>
          </div>
        </div>
    </section>
  )
}
