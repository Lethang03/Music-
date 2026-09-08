import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft, Play, Pause, Clock, Calendar,
  AlertCircle, RefreshCw, Mic
} from 'lucide-react'
import { supabase, supabaseReady } from '../../lib/supabase'
import { useAudio } from '../../contexts/AudioContext'
import { useLibrary } from '../../contexts/LibraryContext'

import TiltCard from '../../components/ui/TiltCard'

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (!secs || secs === 0) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr))
  } catch { return null }
}

// ─── Episode Row Component ───────────────────────────────────────────────
function EpisodeRow({ episode, index, isPlaying, isActive, onPlay, progress }) {
  const progressPct = progress?.[episode.id]?.pct ?? 0
  const completed   = progress?.[episode.id]?.done ?? false
  const dur = formatDuration(episode.duration)
  const date = formatDate(episode.published_at || episode.created_at)

  return (
    <div
      className={`v2-ep-row ${isActive ? 'active' : ''} ${completed ? 'completed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={e => e.key === 'Enter' && onPlay()}
    >
      <div className="v2-ep-num">
        {isActive && isPlaying
          ? <span className="v2-ep-playing-anim" aria-label="Playing"><Pause size={16} fill="currentColor" /></span>
          : <span className="v2-ep-index">{episode.episode_number ?? index + 1}</span>
        }
      </div>

      <div className="v2-ep-info">
        <strong className="v2-ep-title">{episode.title}</strong>
        {episode.description && episode.description !== episode.title && (
          <p className="v2-ep-desc">{episode.description}</p>
        )}
        <div className="v2-ep-meta">
          {date && <span><Calendar size={12} /> {date}</span>}
          {dur  && <span><Clock size={12} /> {dur}</span>}
          {completed && <span className="v2-ep-done">✓ Đã nghe</span>}
        </div>
        {progressPct > 0 && !completed && (
          <div className="v2-ep-progress">
            <div className="v2-ep-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <button
        className={`v2-ep-play-btn ${isActive ? 'active' : ''}`}
        onClick={e => { e.stopPropagation(); onPlay() }}
        title={isActive && isPlaying ? 'Pause' : 'Play'}
        tabIndex={-1}
      >
        {isActive && isPlaying
          ? <Pause size={18} fill="currentColor" />
          : <Play  size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
        }
      </button>
    </div>
  )
}

// ─── Main PodcastDetail ──────────────────────────────────────────────────
export default function PodcastDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { podcasts, episodes: catalogEpisodes, loading, progress, error, loadPublicLibrary } = useLibrary()
  const { activeItem, isPlaying, playItem, togglePlay } = useAudio()
  const [selectedSeason, setSelectedSeason] = useState(null)
  useEffect(() => { setSelectedSeason(null) }, [id])
  const podcast = podcasts.find(p => p.id === id)
  const episodes = catalogEpisodes.filter(e => e.podcast_id === id).sort((a, b) => (a.season_number || 0) - (b.season_number || 0) || (a.episode_number || 0) - (b.episode_number || 0) || (a.published_at || '').localeCompare(b.published_at || ''))
  const loadingPod = loading, loadingEps = loading
  const errorPod = !loading && !podcast ? 'Podcast not found or unavailable.' : null
  const errorEps = error && !episodes.length ? error : null
  const fetchEpisodes = loadPublicLibrary

  const seasons = [...new Set(episodes.map(e => e.season_number).filter(s => s != null))].sort((a, b) => a - b)
  const hasSeasons = seasons.length > 1

  const displayedEpisodes = (selectedSeason != null && hasSeasons)
    ? episodes.filter(e => e.season_number === selectedSeason)
    : episodes

  // ── Play handler ───────────────────────────────────────────────────────
  const handlePlay = useCallback((episode, episodeIndex) => {
    // Build queue from the currently displayed episodes (season-filtered or all)
    // Map episodes to the format AudioContext expects
    const queue = displayedEpisodes.map(ep => ({
      ...ep,
      // AudioContext reads: audio_url OR url, image_url OR cover_url OR image
      audio_url: ep.audio_url,
      image_url: podcast?.image || podcast?.cover_url,
      cover_url: podcast?.image || podcast?.cover_url,
      artist: podcast?.author,
      album:  podcast?.title,
      type:   'episode',
    }))

    if (activeItem?.id === episode.id && activeItem?.type === 'episode') { togglePlay(); return }
    playItem(queue[episodeIndex], queue, episodeIndex)
  }, [displayedEpisodes, podcast, playItem, activeItem, togglePlay])

  // ── Loading states ─────────────────────────────────────────────────────
  if (loadingPod) {
    return (
      <div className="v2-page-loading">
        <Mic size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
        Đang tải podcast...
      </div>
    )
  }

  if (errorPod) {
    return (
      <div className="v2-pd-error">
        <AlertCircle size={48} />
        <h2>Không thể tải podcast</h2>
        <p>{errorPod}</p>
        <button className="v2-btn-secondary" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Quay lại
        </button>
      </div>
    )
  }

  if (!podcast) return null

  const artworkUrl = podcast.image || podcast.cover_url

  return (
    <div className="v2-page v2-animate-fade">

      {/* Back nav */}
      <Link to="/podcasts" className="v2-back-link">
        <ChevronLeft size={18} /> Tất cả Podcasts
      </Link>

      {/* Podcast Hero */}
      <header className="v2-pd-hero">
        <TiltCard className="v2-pd-artwork-wrap">
          {artworkUrl
            ? <img src={artworkUrl} alt={podcast.title} className="v2-pd-artwork" />
            : <div className="v2-pd-artwork-placeholder"><Mic size={48} /></div>
          }
        </TiltCard>
        <div className="v2-pd-hero-info">
          <span className="v2-pd-type-badge">PODCAST</span>
          <h1 className="v2-pd-title">{podcast.title}</h1>
          {podcast.author && <p className="v2-pd-author">by {podcast.author}</p>}
          {podcast.description && <p className="v2-pd-desc">{podcast.description}</p>}
          <div className="v2-pd-stats">
            <span>{episodes.length} tập</span>
            {seasons.length > 0 && <span>· {seasons.length} mùa</span>}
          </div>
          {displayedEpisodes.length > 0 && (
            <button
              className="v2-btn-primary"
              style={{ marginTop: 12, width: 'max-content' }}
              onClick={() => handlePlay(displayedEpisodes[0], 0)}
            >
              <Play size={18} fill="currentColor" /> Phát từ đầu
            </button>
          )}
        </div>
      </header>

      {/* Season tabs — only if multiple seasons */}
      {hasSeasons && (
        <div className="v2-filter-row" role="tablist" aria-label="Season filter">
          <button
            role="tab"
            className={`v2-filter-pill ${selectedSeason === null ? 'active' : ''}`}
            onClick={() => setSelectedSeason(null)}
          >
            Tất cả
          </button>
          {seasons.map(s => (
            <button
              key={s}
              role="tab"
              className={`v2-filter-pill ${selectedSeason === s ? 'active' : ''}`}
              onClick={() => setSelectedSeason(s)}
            >
              Mùa {s}
            </button>
          ))}
        </div>
      )}

      {/* Episodes */}
      <section className="v2-pd-episodes">
        <div className="v2-section-hdr">
          <h2>Các tập</h2>
          <span className="v2-ep-count">{displayedEpisodes.length} tập</span>
        </div>

        {loadingEps ? (
          <div className="v2-pd-ep-loading">
            <div className="v2-spinner" /> Đang tải danh sách tập...
          </div>
        ) : errorEps ? (
          <div className="v2-pd-ep-error">
            <AlertCircle size={32} />
            <p>Không thể tải danh sách tập</p>
            <small style={{ color: 'var(--text-tertiary)' }}>{errorEps}</small>
            <button className="v2-btn-secondary" onClick={fetchEpisodes}>
              <RefreshCw size={14} /> Thử lại
            </button>
          </div>
        ) : displayedEpisodes.length === 0 ? (
          <div className="v2-pd-ep-empty">
            <Mic size={40} />
            <p>Podcast này chưa có tập nào.</p>
          </div>
        ) : (
          <div className="v2-ep-list">
            {displayedEpisodes.map((ep, i) => {
              const isActive = activeItem?.id === ep.id
              return (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  index={i}
                  isActive={isActive}
                  isPlaying={isActive && isPlaying}
                  onPlay={() => handlePlay(ep, i)}
                  progress={progress}
                />
              )
            })}
          </div>
        )}
      </section>

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }

        /* Back link */
        .v2-back-link {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--text-secondary); font-size: 0.875rem; font-weight: 600;
          text-decoration: none; transition: color 0.15s;
          width: max-content;
        }
        .v2-back-link:hover { color: var(--text-primary); }

        /* Hero */
        .v2-pd-hero {
          display: flex; gap: 40px; align-items: flex-start;
        }
        .v2-pd-artwork-wrap {
          width: 240px; height: 240px; flex-shrink: 0;
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        .v2-pd-artwork { width: 100%; height: 100%; object-fit: cover; }
        .v2-pd-artwork-placeholder {
          width: 100%; height: 100%;
          background: var(--bg-panel-elevated);
          display: grid; place-items: center;
          color: var(--text-tertiary);
        }

        .v2-pd-hero-info { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .v2-pd-type-badge {
          font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.12em;
          color: var(--accent-primary);
        }
        .v2-pd-title {
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          font-weight: 800; letter-spacing: -0.025em; line-height: 1.15;
        }
        .v2-pd-author { color: var(--text-secondary); font-size: 1rem; }
        .v2-pd-desc {
          color: var(--text-secondary); font-size: 0.9375rem; line-height: 1.55;
          max-width: 680px;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .v2-pd-stats { display: flex; gap: 8px; color: var(--text-tertiary); font-size: 0.875rem; font-weight: 600; }

        /* Filter row */
        .v2-filter-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .v2-filter-row::-webkit-scrollbar { display: none; }
        .v2-filter-pill {
          white-space: nowrap; padding: 8px 20px; border-radius: var(--radius-full);
          background: transparent; border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary); font-weight: 600; font-size: 0.875rem;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
        }
        .v2-filter-pill:hover { border-color: rgba(255,255,255,0.25); color: var(--text-primary); }
        .v2-filter-pill.active { background: var(--accent-gradient); border-color: transparent; color: white; }

        /* Episodes section */
        .v2-pd-episodes { display: flex; flex-direction: column; gap: 16px; }
        .v2-section-hdr { display: flex; align-items: center; justify-content: space-between; }
        .v2-section-hdr h2 { font-size: 1.375rem; font-weight: 800; }
        .v2-ep-count { font-size: 0.875rem; color: var(--text-tertiary); font-weight: 600; }

        /* Episode loading / error / empty */
        .v2-pd-ep-loading {
          display: flex; align-items: center; gap: 12px;
          padding: 32px; color: var(--text-secondary); font-size: 0.9375rem;
        }
        .v2-spinner {
          width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.1);
          border-top-color: var(--accent-primary); border-radius: 50%;
          animation: v2-spin 0.7s linear infinite;
        }
        @keyframes v2-spin { to { transform: rotate(360deg); } }

        .v2-pd-ep-error {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 48px 24px; text-align: center;
          color: var(--text-secondary);
        }
        .v2-pd-ep-error svg { color: #f87171; }
        .v2-pd-ep-error p { font-size: 1rem; font-weight: 600; color: var(--text-primary); }

        .v2-pd-ep-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px; padding: 64px 24px; text-align: center;
          color: var(--text-tertiary);
        }
        .v2-pd-ep-empty p { font-size: 1rem; color: var(--text-secondary); }

        /* Error state */
        .v2-pd-error {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; min-height: 60vh; justify-content: center; text-align: center;
          color: var(--text-secondary);
        }
        .v2-pd-error svg { color: #f87171; opacity: 0.8; }
        .v2-pd-error h2 { font-size: 1.5rem; color: var(--text-primary); }

        /* Episode list */
        .v2-ep-list { display: flex; flex-direction: column; gap: 2px; }

        /* Episode row */
        .v2-ep-row {
          display: flex; align-items: center; gap: 16px;
          padding: 14px 16px; border-radius: 12px;
          cursor: pointer; transition: background 0.15s;
          position: relative;
        }
        .v2-ep-row:hover { background: rgba(255,255,255,0.04); }
        .v2-ep-row:hover .v2-ep-play-btn { opacity: 1; transform: scale(1); }
        .v2-ep-row.active { background: rgba(255,255,255,0.06); }
        .v2-ep-row.completed .v2-ep-title { color: var(--text-secondary); }

        .v2-ep-num {
          width: 32px; text-align: center; flex-shrink: 0;
          color: var(--text-tertiary); font-size: 0.875rem;
          display: flex; align-items: center; justify-content: center;
        }
        .v2-ep-index { font-variant-numeric: tabular-nums; font-weight: 600; }
        .v2-ep-playing-anim { color: var(--accent-primary); }

        .v2-ep-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .v2-ep-title {
          font-size: 0.9375rem; font-weight: 700; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .v2-ep-desc {
          font-size: 0.8125rem; color: var(--text-tertiary); line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
        }
        .v2-ep-meta {
          display: flex; align-items: center; gap: 12px;
          font-size: 0.75rem; color: var(--text-tertiary);
        }
        .v2-ep-meta span { display: flex; align-items: center; gap: 4px; }
        .v2-ep-done { color: var(--accent-secondary) !important; font-weight: 700; }

        .v2-ep-progress {
          width: 100%; height: 2px; background: rgba(255,255,255,0.08); border-radius: 1px; overflow: hidden;
          margin-top: 4px;
        }
        .v2-ep-progress-fill { height: 100%; background: var(--accent-gradient); border-radius: 1px; }

        .v2-ep-play-btn {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: white; color: black; border: none;
          display: grid; place-items: center; cursor: pointer;
          opacity: 0; transform: scale(0.85);
          transition: all 0.15s; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .v2-ep-play-btn.active { opacity: 1; transform: scale(1); background: var(--accent-primary); color: white; }
        .v2-ep-play-btn:hover { transform: scale(1.08) !important; }

        /* Responsive */
        @media (hover: none) {
          .v2-ep-play-btn { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          .v2-pd-hero { flex-direction: column; align-items: center; text-align: center; }
          .v2-pd-artwork-wrap { width: 180px; height: 180px; }
          .v2-pd-hero-info { align-items: center; }
          .v2-pd-desc { -webkit-line-clamp: 4; }
          .v2-ep-row { padding: 12px; gap: 10px; }
        }
      `}</style>
    </div>
  )
}
