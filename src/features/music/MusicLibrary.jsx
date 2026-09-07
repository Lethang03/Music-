import React, { useState } from 'react'
import { Play, ChevronRight } from 'lucide-react'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAudio } from '../../contexts/AudioContext'

const GENRE_FILTERS = ['Tất cả', 'Pop', 'Rock', 'Indie', 'Lofi', 'EDM', 'R&B', 'Hip Hop', 'Acoustic', 'V-Pop']

export default function MusicLibrary() {
  const { tracks, loading } = useLibrary()
  const { playItem } = useAudio()
  const [activeFilter, setActiveFilter] = useState('Tất cả')

  if (loading) return <div className="v2-page-loading">Loading Music...</div>

  const hasTracks = tracks?.length > 0

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-hdr">
        <h1>Khám phá âm nhạc</h1>
        <p>Những bài hát đang chờ bạn khám phá.</p>
      </header>

      <div className="v2-filter-row" role="tablist" aria-label="Genre filter">
        {GENRE_FILTERS.map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={activeFilter === f}
            className={`v2-filter-pill ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {hasTracks ? (
        <div className="v2-premium-grid">
          {tracks.map((track, i) => (
            <div
              key={track.id}
              className="v2-premium-card"
              onClick={() => playItem(track, tracks, i)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && playItem(track, tracks, i)}
            >
              <div className="v2-card-artwork">
                <img
                  src={track.image_url || track.cover_url}
                  alt={track.title}
                  loading="lazy"
                />
                <div className="v2-card-overlay">
                  <button className="v2-card-play-btn" tabIndex={-1}>
                    <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
                  </button>
                </div>
              </div>
              <div className="v2-card-meta">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="v2-music-empty">
          <div className="v2-music-empty-icon">🎸</div>
          <h2>No tracks yet</h2>
          <p>Tracks published by an admin will appear here.</p>
        </div>
      )}

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }
        .v2-page-hdr h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 6px; }
        .v2-page-hdr p  { color: var(--text-secondary); font-size: 1rem; }

        .v2-filter-row {
          display: flex; gap: 10px; overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .v2-filter-row::-webkit-scrollbar { display: none; }

        .v2-filter-pill {
          white-space: nowrap; padding: 8px 20px;
          border-radius: var(--radius-full);
          background: transparent;
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary);
          font-weight: 600; font-size: 0.875rem;
          cursor: pointer; transition: all 0.15s;
          flex-shrink: 0;
        }
        .v2-filter-pill:hover { border-color: rgba(255,255,255,0.25); color: var(--text-primary); }
        .v2-filter-pill.active {
          background: var(--accent-gradient);
          border-color: transparent; color: white;
        }

        .v2-music-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px; min-height: 40vh; justify-content: center;
          text-align: center; color: var(--text-secondary);
        }
        .v2-music-empty-icon { font-size: 3.5rem; }
        .v2-music-empty h2 { font-size: 1.5rem; color: var(--text-primary); }
      `}</style>
    </div>
  )
}
