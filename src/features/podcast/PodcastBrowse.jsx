import React, { useState } from 'react'
import { Play, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../../contexts/LibraryContext'
import TiltCard from '../../components/ui/TiltCard'

const CATEGORY_FILTERS = ['Tất cả', 'Giáo dục', 'Tâm lý', 'Công nghệ', 'Kinh doanh', 'Đời sống', 'Sức khỏe']

export default function PodcastBrowse() {
  const { podcasts, loading } = useLibrary()
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('All')
  const categories = ['All', ...new Set(podcasts.map(p => p.category).filter(Boolean))]
  const filtered = podcasts.filter(p => activeFilter === 'All' || p.category === activeFilter)

  if (loading) return <div className="v2-page-loading">Loading Podcasts...</div>

  const hasPodcasts = filtered.length > 0

  const handlePodcastClick = (pod) => {
    navigate(`/podcasts/${pod.id}`)
  }

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-hdr">
        <h1>Khám phá Podcasts</h1>
        <p>Những câu chuyện truyền cảm hứng, kiến thức và giải trí.</p>
      </header>

      <div className="v2-filter-row" role="tablist" aria-label="Category filter">
        {categories.map(f => (
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

      {/* Hero Banner */}
      <TiltCard className="v2-podcast-hero">
        <div className="v2-podcast-hero-text">
          <h2>Những câu chuyện làm bạn<br />lớn hơn mỗi ngày</h2>
          <button className="v2-btn-primary" disabled={!filtered.length} onClick={() => handlePodcastClick(filtered[0])} style={{ width: 'max-content', marginTop: '8px' }}>
            Khám phá ngay
          </button>
        </div>
      </TiltCard>

      {hasPodcasts ? (
        <section className="v2-section">
          <div className="v2-section-hdr">
            <h2>Podcast nổi bật</h2>
            <span className="v2-ep-count">{filtered.length} shows</span>
          </div>
          <div className="v2-premium-grid">
            {filtered.map((pod) => (
              <TiltCard
                key={pod.id}
                className="v2-premium-card"
                role="button"
                tabIndex={0}
                onClick={() => handlePodcastClick(pod)}
                onKeyDown={e => e.key === 'Enter' && handlePodcastClick(pod)}
                title={`Mở ${pod.title}`}
              >
                <div className="v2-card-artwork podcast-artwork">
                  <img
                    src={pod.image || pod.cover_url}
                    alt={pod.title}
                    loading="lazy"
                  />
                  <div className="v2-card-overlay">
                    {/* This opens the detail page, not plays */}
                    <button className="v2-card-play-btn" tabIndex={-1} aria-label="Mở podcast">
                      <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
                    </button>
                  </div>
                </div>
                <div className="v2-card-meta">
                  <strong>{pod.title}</strong>
                  <span>{pod.author}</span>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>
      ) : (
        <div className="v2-podcast-empty">
          <div className="v2-podcast-empty-icon">🎙️</div>
          <h2>No podcasts yet</h2>
          <p>Podcasts published by an admin will appear here.</p>
        </div>
      )}

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }
        .v2-page-hdr h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 6px; }
        .v2-page-hdr p  { color: var(--text-secondary); font-size: 1rem; }

        .v2-filter-row {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .v2-filter-row::-webkit-scrollbar { display: none; }
        .v2-filter-pill {
          white-space: nowrap; padding: 10px 20px;
          border-radius: var(--radius-full);
          background: transparent; border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary); font-weight: 600; font-size: 0.875rem;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
        }
        .v2-filter-pill:hover { border-color: rgba(255,255,255,0.25); color: var(--text-primary); }
        .v2-filter-pill.active { background: var(--accent-gradient); border-color: transparent; color: white; }

        .v2-podcast-hero {
          width: 100%; border-radius: 20px; overflow: hidden;
          padding: 48px 48px;
          background:
            linear-gradient(90deg, rgba(11,11,30,0.9) 0%, rgba(11,11,30,0.6) 100%),
            url('https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=1200') center/cover;
          box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        }
        .v2-podcast-hero-text h2 {
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          font-weight: 800; line-height: 1.2; letter-spacing: -0.02em;
          margin-bottom: 16px;
        }

        .v2-section { display: flex; flex-direction: column; gap: 20px; }
        .v2-section-hdr { display: flex; align-items: center; justify-content: space-between; }
        .v2-section-hdr h2 { font-size: 1.375rem; font-weight: 800; }
        .v2-ep-count { font-size: 0.875rem; color: var(--text-tertiary); font-weight: 600; }

        .v2-podcast-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px; min-height: 40vh; justify-content: center;
          text-align: center; color: var(--text-secondary);
        }
        .v2-podcast-empty-icon { font-size: 3.5rem; }
        .v2-podcast-empty h2 { font-size: 1.5rem; color: var(--text-primary); }

        /* Card hover cursor fix */
        .v2-premium-card { cursor: pointer; }

        @media (max-width: 768px) {
          .v2-podcast-hero { padding: 32px 24px; }
        }
      `}</style>
    </div>
  )
}
