import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Shuffle, ChevronRight } from 'lucide-react'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAudio } from '../../contexts/AudioContext'
import TiltCard from '../../components/ui/TiltCard'

// Stable mini progress width — avoid Math.random() in render (causes StrictMode re-renders)

export default function HomePage() {
  const navigate = useNavigate()
  const { tracks, podcasts, loading, history } = useLibrary()
  const { playItem, setShuffle } = useAudio()

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  if (loading) {
    return (
      <div className="v2-page-loading">
        Loading your personalized experience...
      </div>
    )
  }

  const continuing = history.filter(row => !row.completed && row.position > 0).slice(0, 6)
  const hasTracks   = tracks?.length   > 0
  const hasPodcasts = podcasts?.length > 0

  return (
    <div className="v2-page v2-animate-fade">

      {/* Hero */}
      <section className="v2-home-hero">
        <div className="v2-home-hero-text">
          <span className="v2-greeting-badge">{getGreeting()}</span>
          <h1 className="v2-hero-headline">
            Âm nhạc và<br />
            <span className="v2-text-gradient">những câu chuyện,</span><br />
            ở cùng một nơi.
          </h1>
          <p className="v2-hero-sub">Khám phá thế giới âm thanh theo cách của bạn.</p>
          <div className="v2-hero-actions">
            <button
              className="v2-btn-primary"
              disabled={!hasTracks}
              onClick={() => { const index = Math.floor(Math.random() * tracks.length); setShuffle(true); playItem(tracks[index], tracks, index) }}
            >
              <Shuffle size={18} /> Phát ngẫu nhiên
            </button>
            <button className="v2-btn-secondary" onClick={() => navigate('/search')}>
              Khám phá ngay
            </button>
          </div>
        </div>
        <div className="v2-home-hero-visual-container">
          <TiltCard className="v2-home-hero-visual" aria-hidden="true">
            <div className="v2-hero-vinyl" />
            <img
              src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=900"
              alt=""
            />
            <div className="v2-hero-visual-overlay">
              <h3>Music heals<br />a different<br />kind of you</h3>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* Continue Listening */}
      {continuing.length > 0 && (
        <section className="v2-section">
          <div className="v2-section-hdr">
            <h2>Tiếp tục nghe</h2>
            <button className="v2-text-link" onClick={() => navigate('/library')}>Xem tất cả <ChevronRight size={14} /></button>
          </div>
          <div className="v2-premium-grid">
            {continuing.map((row, i) => { const track = row.item; return (
              <TiltCard
                key={track.id}
                className="v2-premium-card"
                onClick={() => playItem(track, continuing.map(r => r.item), i, row.position)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && playItem(track, continuing.map(r => r.item), i, row.position)}
              >
                <div className="v2-card-artwork">
                  <img src={track.image_url || track.cover_url} alt={track.title} />
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
                <div className="v2-card-mini-progress">
                  <div style={{ width: `${row.duration ? Math.min(100, row.position / row.duration * 100) : 0}%` }} />
                </div>
              </TiltCard>
            )})}
          </div>
        </section>
      )}

      {/* Podcasts */}
      {hasPodcasts && (
        <section className="v2-section">
          <div className="v2-section-hdr">
            <h2>Dành cho bạn</h2>
            <button className="v2-text-link" onClick={() => navigate('/podcasts')}>Xem tất cả <ChevronRight size={14} /></button>
          </div>
          <div className="v2-premium-grid">
            {podcasts.slice(0, 6).map((pod) => (
              <TiltCard 
                key={pod.id} 
                className="v2-premium-card" 
                role="button" 
                tabIndex={0}
                onClick={() => navigate(`/podcasts/${pod.id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/podcasts/${pod.id}`)}
              >
                <div className="v2-card-artwork podcast-artwork">
                  <img src={pod.image} alt={pod.title} />
                  <div className="v2-card-overlay">
                    <button className="v2-card-play-btn" tabIndex={-1}>
                      <Play size={22} fill="currentColor" style={{ marginLeft: '2px' }} />
                    </button>
                  </div>
                </div>
                <div className="v2-card-meta">
                  <strong>{pod.title}</strong>
                  <span>Podcast · {pod.author}</span>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when no data */}
      {!hasTracks && !hasPodcasts && (
        <div className="v2-home-empty">
          <div className="v2-home-empty-icon">🎵</div>
          <h2>Welcome to SoundVerse</h2>
          <p>Your library is empty. Ask an admin to add content.</p>
        </div>
      )}

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 56px; }

        /* Hero */
        .v2-home-hero {
          display: flex; gap: 40px; align-items: center;
          min-height: 360px;
        }
        .v2-home-hero-text {
          flex: 1; display: flex; flex-direction: column; gap: 16px;
        }
        .v2-greeting-badge {
          display: inline-block;
          font-size: 0.875rem; font-weight: 700; color: var(--text-secondary);
          letter-spacing: 0.04em;
        }
        .v2-hero-headline {
          font-size: clamp(2rem, 4vw, 3.5rem);
          font-weight: 800; line-height: 1.1; letter-spacing: -0.025em;
          color: var(--text-primary);
        }
        .v2-text-gradient {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .v2-hero-sub {
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.55;
        }
        .v2-hero-actions { display: flex; gap: 12px; flex-wrap: wrap; }

        .v2-home-hero-visual-container {
          flex: 1.1; 
          position: relative;
          height: 360px; min-width: 0;
          display: flex;
          justify-content: flex-end;
        }
        .v2-home-hero-visual {
          width: 85%;
          height: 100%;
          position: relative;
          border-radius: 20px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        .v2-home-hero-visual img {
          width: 100%; height: 100%; object-fit: cover;
          position: relative; z-index: 2; border-radius: 20px;
        }
        .v2-hero-vinyl {
          position: absolute;
          top: 5%; bottom: 5%; left: -20%;
          aspect-ratio: 1;
          background: repeating-radial-gradient(#111, #111 4px, #1a1a1a 5px, #111 6px);
          border-radius: 50%;
          z-index: 1;
          box-shadow: -10px 0 40px rgba(0,0,0,0.8);
          animation: v2-hero-vinyl-spin 20s linear infinite;
        }
        .v2-hero-vinyl::after {
          content: '';
          position: absolute;
          inset: 38%;
          background: var(--accent-gradient);
          border-radius: 50%;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }
        .v2-hero-vinyl::before {
          content: '';
          position: absolute;
          inset: 48%;
          background: #111;
          border-radius: 50%;
          z-index: 2;
        }
        @keyframes v2-hero-vinyl-spin {
          100% { transform: rotate(360deg); }
        }

        .v2-hero-visual-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(130deg, rgba(11,11,19,0.1) 0%, rgba(11,11,19,0.75) 100%);
          display: flex; align-items: flex-end; justify-content: flex-end;
          padding: 32px; z-index: 3; border-radius: 20px;
          pointer-events: none;
        }
        .v2-hero-visual-overlay h3 {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic; font-size: 2rem;
          color: rgba(255,255,255,0.75);
          text-align: right; line-height: 1.25; font-weight: 400;
        }

        /* Sections */
        .v2-section { display: flex; flex-direction: column; gap: 20px; }
        .v2-section-hdr {
          display: flex; align-items: center; justify-content: space-between;
        }
        .v2-section-hdr h2 {
          font-size: 1.375rem; font-weight: 800; letter-spacing: -0.01em;
        }
        .v2-text-link {
          display: inline-flex; align-items: center; gap: 2px;
          font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary);
          background: none; border: none; cursor: pointer; transition: color 0.15s;
        }
        .v2-text-link:hover { color: var(--text-primary); }

        /* Mini progress */
        .v2-card-mini-progress {
          width: 100%; height: 2px;
          background: rgba(255,255,255,0.08); border-radius: 1px; overflow: hidden;
        }
        .v2-card-mini-progress div {
          height: 100%; background: var(--accent-gradient); border-radius: 1px;
        }

        /* Empty state */
        .v2-home-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 16px;
          min-height: 40vh; text-align: center;
          color: var(--text-secondary);
        }
        .v2-home-empty-icon { font-size: 4rem; }
        .v2-home-empty h2 { font-size: 1.75rem; color: var(--text-primary); }
        .v2-home-empty p { font-size: 1rem; }

        /* Responsive */
        @media (max-width: 1100px) {
          .v2-home-hero {
            flex-direction: column;
            text-align: center; align-items: center;
          }
          .v2-home-hero-text { align-items: center; }
          .v2-home-hero-visual-container { width: 100%; flex: none; justify-content: center; max-height: 280px; }
          .v2-home-hero-visual { width: 85%; }
        }
        @media (max-width: 768px) {
          .v2-page { gap: 36px; }
          .v2-hero-visual-overlay h3 { font-size: 1.5rem; }
          .v2-home-hero-visual { width: 100%; }
          .v2-hero-vinyl { display: none; }
        }
      `}</style>
    </div>
  )
}
