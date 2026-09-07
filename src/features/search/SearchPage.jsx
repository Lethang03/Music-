import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, Play } from 'lucide-react'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAudio } from '../../contexts/AudioContext'

export default function SearchPage() {
  const navigate = useNavigate()
  const { tracks, podcasts } = useLibrary()
  const { playItem } = useAudio()
  const [query, setQuery] = useState('')

  const filteredTracks = tracks?.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) || 
    t.artist?.toLowerCase().includes(query.toLowerCase())
  ) || []

  const filteredPodcasts = podcasts?.filter(p => 
    p.title.toLowerCase().includes(query.toLowerCase()) || 
    p.author?.toLowerCase().includes(query.toLowerCase())
  ) || []

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-header">
        <h1>Search</h1>
      </header>

      <div className="v2-search-input-wrapper">
        <SearchIcon size={20} className="v2-search-icon" />
        <input 
          type="text" 
          placeholder="Artists, songs, or podcasts" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query ? (
        <div className="v2-search-results">
          {filteredTracks.length > 0 && (
            <section className="v2-section">
              <h2>Songs</h2>
              <div className="v2-list">
                {filteredTracks.slice(0, 5).map((track, i) => (
                  <div key={track.id} className="v2-list-item" onClick={() => playItem(track, filteredTracks, i)}>
                    <img src={track.image_url || track.cover_url} alt="" />
                    <div className="v2-list-item-info">
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

            {filteredPodcasts.length > 0 && (
              <section className="v2-section">
                <h2>Podcasts</h2>
                <div className="v2-grid">
                  {filteredPodcasts.slice(0, 4).map(podcast => (
                    <div 
                      key={podcast.id} 
                      className="v2-card" 
                      onClick={() => navigate(`/podcasts/${podcast.id}`)}
                    >
                      <div className="v2-card-img"><img src={podcast.image || podcast.cover_url} alt="" /></div>
                      <div className="v2-card-info">
                        <strong>{podcast.title}</strong>
                        <small>{podcast.author}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {filteredTracks.length === 0 && filteredPodcasts.length === 0 && (
              <div className="v2-empty-state" style={{ marginTop: '40px' }}>
                No results found for "{query}"
              </div>
            )}
          </div>
        ) : (
          <div className="v2-search-idle">
            <h2>Browse All</h2>
            <div className="v2-grid-browse">
              <div className="v2-browse-card" onClick={() => setQuery('Pop')} style={{ background: 'linear-gradient(135deg, #FF0076, #590FB7)' }}>Pop</div>
              <div className="v2-browse-card" onClick={() => setQuery('Electronic')} style={{ background: 'linear-gradient(135deg, #00C9FF, #92FE9D)' }}>Electronic</div>
              <div className="v2-browse-card" onClick={() => setQuery('Hip-Hop')} style={{ background: 'linear-gradient(135deg, #F09819, #EDDE5D)' }}>Hip-Hop</div>
              <div className="v2-browse-card" onClick={() => setQuery('Podcast')} style={{ background: 'linear-gradient(135deg, #8E2DE2, #4A00E0)' }}>Podcasts</div>
            </div>
          </div>
        )}

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }
        .v2-page-header h1 { font-size: 2.5rem; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.02em; }
        
        .v2-search-input-wrapper {
          position: relative;
          max-width: 600px;
        }
        .v2-search-icon {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          color: var(--text-secondary);
        }
        .v2-search-input-wrapper input {
          width: 100%;
          background: var(--bg-panel-elevated);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-full);
          padding: 16px 16px 16px 48px;
          color: var(--text-primary);
          font-size: 1.125rem;
          outline: none;
          transition: var(--transition-fast);
        }
        .v2-search-input-wrapper input:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .v2-section h2 { font-size: 1.5rem; margin-bottom: 16px; font-weight: 800; }
        .v2-search-results { display: flex; flex-direction: column; gap: 48px; }
        
        .v2-list { display: flex; flex-direction: column; gap: 8px; }
        .v2-list-item {
          display: flex; align-items: center; gap: 16px; padding: 12px;
          background: var(--bg-panel-elevated); border-radius: var(--radius-md);
          cursor: pointer; transition: background var(--transition-fast);
        }
        .v2-list-item:hover { background: var(--bg-panel-hover); }
        .v2-list-item img { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; }
        .v2-list-item-info strong { display: block; font-size: 1rem; margin-bottom: 2px; }
        .v2-list-item-info small { color: var(--text-secondary); font-size: 0.875rem; }
        
        .v2-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px; }
        .v2-card { background: var(--bg-panel-elevated); padding: 16px; border-radius: var(--radius-lg); cursor: pointer; transition: var(--transition-fast); }
        .v2-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
        .v2-card-img { width: 100%; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 16px; }
        .v2-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .v2-card-info strong { display: block; font-size: 1rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-card-info small { color: var(--text-secondary); font-size: 0.875rem; }

        .v2-search-idle h2 { font-size: 1.5rem; margin-bottom: 24px; font-weight: 800; }
        .v2-grid-browse { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; }
        .v2-browse-card {
          aspect-ratio: 1; border-radius: var(--radius-lg); padding: 24px;
          font-size: 1.5rem; font-weight: 800; color: white;
          box-shadow: var(--shadow-md); cursor: pointer;
          transition: transform var(--transition-fast);
        }
        .v2-browse-card:hover { transform: scale(1.02); box-shadow: var(--shadow-lg); }

        .v2-empty-state { color: var(--text-tertiary); font-size: 1.125rem; font-style: italic; }
      `}</style>
    </div>
  )
}

