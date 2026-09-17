import { mediaProvider } from '../../services/media'
import React, { useState } from 'react'
import { Play, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../../contexts/LibraryContext'
import TiltCard from '../../components/ui/TiltCard'
import PodcastHero from './PodcastHero'

const CATEGORY_FILTERS = ['Tất cả', 'Giáo dục', 'Tâm lý', 'Công nghệ', 'Kinh doanh', 'Đời sống', 'Sức khỏe']

export default function PodcastBrowse() {
  const { podcasts, episodes = [], loading } = useLibrary()
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('Tất cả')

  // Merge default curated categories with any dynamic categories present in the database
  const dynamicCategories = Array.from(new Set(podcasts.map(p => p.category).filter(Boolean)))
  const categories = ['Tất cả', ...Array.from(new Set([...CATEGORY_FILTERS.slice(1), ...dynamicCategories]))]

  const filtered = podcasts.filter(p => {
    if (activeFilter === 'Tất cả' || activeFilter === 'All') return true
    return p.category === activeFilter
  })

  if (loading) return <div className="v2-page-loading">Loading Podcasts...</div>

  const hasPodcasts = filtered.length > 0

  const handlePodcastClick = (pod) => {
    navigate(`/podcasts/${pod.id}`)
  }

  return (
    <div className="v2-page v2-animate-fade">
      {/* SoundVerse Cosmic Podcast Hero */}
      <PodcastHero podcasts={podcasts} episodes={episodes} />

      {/* Category Filter Row - Positioned Elegantly Below Hero */}
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

      {/* Podcast Catalog Section */}
      <section id="podcast-catalog" className="v2-section">
        <div className="v2-section-hdr">
          <h2>{activeFilter === 'Tất cả' ? 'Khám phá Podcast' : `Chủ đề: ${activeFilter}`}</h2>
          <span className="v2-ep-count">{filtered.length} kênh</span>
        </div>

        {hasPodcasts ? (
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
                    src={mediaProvider.getCoverUrl(pod.image || pod.cover_url)}
                    alt={pod.title}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="v2-card-overlay">
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
        ) : (
          <div className="v2-podcast-empty">
            <div className="v2-podcast-empty-icon">🎙️</div>
            <h2>Chưa có podcast nào trong mục này</h2>
            <p>Hãy chọn chủ đề khác hoặc quay lại mục Tất cả.</p>
          </div>
        )}
      </section>

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }

        .v2-filter-row {
          display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: none;
        }
        .v2-filter-row::-webkit-scrollbar { display: none; }
        .v2-filter-pill {
          white-space: nowrap; padding: 10px 20px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-secondary); font-weight: 600; font-size: 0.875rem;
          cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;
        }
        .v2-filter-pill:hover {
          border-color: rgba(245, 158, 11, 0.4);
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
        }
        .v2-filter-pill.active {
          background: linear-gradient(135deg, #38bdf8 0%, #6366f1 50%, #f59e0b 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 4px 16px rgba(56, 189, 248, 0.35);
        }

        .v2-section { display: flex; flex-direction: column; gap: 20px; scroll-margin-top: 24px; }
        .v2-section-hdr { display: flex; align-items: center; justify-content: space-between; }
        .v2-section-hdr h2 { font-size: 1.375rem; font-weight: 800; }
        .v2-ep-count { font-size: 0.875rem; color: var(--text-tertiary); font-weight: 600; }

        .v2-podcast-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 14px; min-height: 30vh; justify-content: center;
          text-align: center; color: var(--text-secondary);
        }
        .v2-podcast-empty-icon { font-size: 3.5rem; }
        .v2-podcast-empty h2 { font-size: 1.5rem; color: var(--text-primary); }

        /* Card hover cursor fix */
        .v2-premium-card { cursor: pointer; }
      `}</style>
    </div>
  )
}
