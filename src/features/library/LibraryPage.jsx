import React, { useState } from 'react'
import { Play, Plus, History, Library as LibraryIcon, X, Loader2, AlertCircle } from 'lucide-react'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function LibraryPage() {
  const { session } = useAuth()
  const { playlists, history, loadPublicLibrary } = useLibrary()
  
  const [isCreating, setIsCreating] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !session?.user?.id) return
    
    setSaving(true)
    setError('')
    try {
      const { error: insertError } = await supabase
        .from('playlists')
        .insert([{ user_id: session.user.id, name: newPlaylistName.trim() }])
        
      if (insertError) throw insertError
      
      setNewPlaylistName('')
      setIsCreating(false)
      await loadPublicLibrary() // Refresh to see the new playlist
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo playlist. Bảng playlists có thể chưa được cấu hình đúng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-header">
        <h1>Your Library</h1>
      </header>

      <section className="v2-section">
        <h2>Playlists</h2>
        <div className="v2-premium-grid">
          <div 
            className="v2-premium-card v2-create-playlist-card"
            role="button"
            tabIndex={0}
            onClick={() => setIsCreating(true)}
            onKeyDown={e => e.key === 'Enter' && setIsCreating(true)}
          >
            <div className="v2-create-icon-wrapper">
              <Plus size={32} />
            </div>
            <strong>Create New</strong>
            <span>Curate your own vibe</span>
          </div>
          
          {playlists?.map(playlist => (
            <div key={playlist.id} className="v2-premium-card">
              <div className="v2-card-artwork">
                 <div className="v2-playlist-placeholder">
                   <LibraryIcon size={32} color="var(--text-tertiary)" />
                 </div>
                 <div className="v2-card-overlay">
                  {/* Playlist playback not fully implemented yet due to missing tracks mapping */}
                  <button className="v2-card-play-btn" onClick={() => alert('Thêm bài hát vào playlist chưa được hỗ trợ (Thiếu bảng backend).')}>
                    <Play size={24} fill="currentColor" style={{ marginLeft: '2px' }} />
                  </button>
                </div>
              </div>
              <div className="v2-card-meta">
                <strong>{playlist.name}</strong>
                <span>Playlist</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* History section marked as coming soon / missing backend */}
      <section className="v2-section" style={{ marginTop: 'var(--space-7)' }}>
        <h2>Listening History <span className="v2-coming-soon-badge">Coming Soon</span></h2>
        <div className="v2-list v2-disabled-feature">
          {history?.slice(0, 10).map((item, i) => (
            <div key={i} className="v2-list-item">
              <div className="v2-list-icon"><History size={20} /></div>
              <div className="v2-list-item-info">
                <strong>{item.media_id}</strong>
                <small>{new Date(item.played_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
          {(!history || history.length === 0) && (
            <div className="v2-empty-state-banner">
              <div className="v2-empty-banner-icon"><History size={32} /></div>
              <div className="v2-empty-banner-text">
                <h3>No history yet</h3>
                <p>History tracking is currently disabled (missing backend tables).</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Create Playlist Modal */}
      {isCreating && (
        <div className="v2-modal-overlay">
          <div className="v2-modal-content">
            <button className="v2-modal-close" onClick={() => setIsCreating(false)}><X size={24} /></button>
            <h2>Create Playlist</h2>
            
            <div className="v2-input-group" style={{ marginTop: 24 }}>
              <label className="v2-label">Name</label>
              <input 
                type="text" 
                className="v2-input" 
                placeholder="My Awesome Playlist"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                autoFocus
              />
            </div>
            
            {error && (
              <div className="v2-alert-error" style={{ marginBottom: 16 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="v2-btn-secondary" onClick={() => setIsCreating(false)} disabled={saving}>
                Cancel
              </button>
              <button 
                className="v2-btn-primary" 
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || saving}
              >
                {saving ? <Loader2 size={16} className="v2-spin" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: var(--space-6); }
        .v2-page-header h1 { font-size: 3rem; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.03em; }
        
        .v2-section h2 { font-size: 1.5rem; margin-bottom: var(--space-5); font-weight: 800; display: flex; align-items: center; gap: 12px; }
        
        .v2-create-playlist-card { 
          align-items: center; justify-content: center; text-align: center;
          background: rgba(255,255,255,0.02);
          border: 1px dashed rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .v2-create-playlist-card:hover { 
          background: rgba(255,255,255,0.05); 
          border-color: var(--accent-primary);
        }
        .v2-create-icon-wrapper { 
          width: 64px; height: 64px; border-radius: 50%; 
          background: rgba(255,255,255,0.05); 
          display: grid; place-items: center; 
          color: var(--text-primary); margin-bottom: var(--space-2);
          transition: transform var(--transition-fast);
        }
        .v2-create-playlist-card:hover .v2-create-icon-wrapper {
          transform: scale(1.1); background: var(--accent-primary);
        }

        .v2-playlist-placeholder {
          width: 100%; height: 100%; display: grid; place-items: center; background: rgba(0,0,0,0.3);
        }

        .v2-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .v2-list-item { 
          display: flex; align-items: center; gap: var(--space-4);
          padding: var(--space-3) var(--space-4); 
          background: var(--bg-panel); border-radius: var(--radius-md); 
          transition: all var(--transition-fast);
        }
        .v2-list-icon { color: var(--text-tertiary); }
        .v2-list-item-info strong { display: block; font-size: 1rem; margin-bottom: 4px; color: var(--text-primary); }
        .v2-list-item-info small { color: var(--text-secondary); font-size: 0.8125rem; }
        
        .v2-empty-state-banner { 
          display: flex; align-items: center; gap: var(--space-5);
          background: linear-gradient(90deg, rgba(255,255,255,0.03), transparent);
          padding: var(--space-5); border-radius: var(--radius-lg);
          border-left: 2px solid var(--border-strong);
        }
        .v2-empty-banner-icon { color: var(--text-tertiary); opacity: 0.5; }
        .v2-empty-banner-text h3 { font-size: 1.125rem; font-weight: 700; margin-bottom: 4px; }
        .v2-empty-banner-text p { color: var(--text-secondary); font-size: 0.9375rem; }

        .v2-disabled-feature { opacity: 0.5; filter: grayscale(1); pointer-events: none; }
        .v2-coming-soon-badge {
          font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
          background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;
          color: var(--text-secondary);
        }

        .v2-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
          z-index: 100; display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }
        .v2-modal-content {
          background: var(--bg-panel-elevated); border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg); padding: 32px; width: 100%; max-width: 480px;
          position: relative; box-shadow: 0 24px 64px rgba(0,0,0,0.5);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .v2-modal-close {
          position: absolute; top: 24px; right: 24px; color: var(--text-secondary);
          background: none; border: none; cursor: pointer; transition: color 0.15s;
        }
        .v2-modal-close:hover { color: var(--text-primary); }

        .v2-alert-error {
          background: rgba(248, 113, 113, 0.1); color: #f87171;
          padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px;
          border: 1px solid rgba(248, 113, 113, 0.2); font-weight: 600; font-size: 0.875rem;
        }

        .v2-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
