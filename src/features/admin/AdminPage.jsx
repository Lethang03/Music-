import React, { useState, useEffect } from 'react'
import { Upload, Music, Mic2, Users, Database, Plus, Trash2, Edit2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('tracks')
  
  const [tracks, setTracks] = useState([])
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const tabs = [
    { id: 'tracks', label: 'Music', icon: Music },
    { id: 'podcasts', label: 'Podcasts', icon: Mic2 },
    { id: 'users', label: 'Users', icon: Users },
  ]

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'tracks') {
        const { data, error } = await supabase.from('music_tracks').select('*').order('created_at', { ascending: false })
        if (error) throw error
        setTracks(data || [])
      } else if (activeTab === 'podcasts') {
        const { data, error } = await supabase.from('podcasts').select('*').order('created_at', { ascending: false })
        if (error) throw error
        setPodcasts(data || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const togglePublish = async (table, id, currentStatus) => {
    try {
      const { error } = await supabase.from(table).update({ published: !currentStatus }).eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-page-header">
        <h1>Admin Console</h1>
        <p>Manage platform content and users.</p>
      </header>

      <div className="v2-admin-tabs">
        {tabs.map(t => (
          <button 
            key={t.id} 
            className={`v2-admin-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>

      <div className="v2-admin-content">
        <div className="v2-admin-toolbar">
          {error && <div style={{ color: 'red', marginRight: 'auto' }}>{error}</div>}
          <button className="v2-btn-primary" onClick={() => alert('Upload modal coming soon')}><Plus size={16} /> Add New</button>
        </div>

        <div className="v2-admin-table-wrapper">
          {loading ? (
            <div className="v2-admin-loading"><Loader2 className="spin" size={32} /></div>
          ) : (
            <table className="v2-admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>{activeTab === 'tracks' ? 'Title / Artist' : 'Title / Author'}</th>
                  {activeTab === 'tracks' && <th>Duration</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'tracks' && tracks.map(track => (
                  <tr key={track.id}>
                    <td>
                      <button 
                        className={`v2-status-badge ${track.published ? 'active' : ''}`}
                        onClick={() => togglePublish('music_tracks', track.id, track.published)}
                      >
                        {track.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td>
                      <strong>{track.title}</strong>
                      <div className="v2-text-sm v2-text-tertiary">{track.artist}</div>
                    </td>
                    <td>{track.duration || '0:00'}</td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="v2-icon-btn"><Edit2 size={16} /></button>
                        <button className="v2-icon-btn v2-text-danger" onClick={() => handleDelete('music_tracks', track.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}

                {activeTab === 'podcasts' && podcasts.map(pod => (
                  <tr key={pod.id}>
                    <td>
                      <button 
                        className={`v2-status-badge ${pod.published ? 'active' : ''}`}
                        onClick={() => togglePublish('podcasts', pod.id, pod.published)}
                      >
                        {pod.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td>
                      <strong>{pod.title}</strong>
                      <div className="v2-text-sm v2-text-tertiary">{pod.author}</div>
                    </td>
                    <td>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="v2-icon-btn"><Edit2 size={16} /></button>
                        <button className="v2-icon-btn v2-text-danger" onClick={() => handleDelete('podcasts', pod.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && tracks.length === 0 && podcasts.length === 0 && (
                  <tr><td colSpan="4" style={{textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)'}}>No data found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 32px; }
        .v2-page-header h1 { font-size: 2.5rem; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.02em; }
        .v2-text-sm { font-size: 0.875rem; }
        .v2-text-tertiary { color: var(--text-tertiary); }
        .v2-text-danger { color: #ef4444; }
        .v2-text-danger:hover { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; }
        
        .v2-admin-tabs { display: flex; gap: 8px; border-bottom: 1px solid var(--border-strong); padding-bottom: 16px; overflow-x: auto; }
        .v2-admin-tab { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--radius-full); font-weight: 600; color: var(--text-secondary); transition: var(--transition-fast); white-space: nowrap; }
        .v2-admin-tab:hover { background: var(--bg-panel-hover); color: var(--text-primary); }
        .v2-admin-tab.active { background: var(--bg-panel-elevated); color: var(--text-primary); border: 1px solid var(--border-strong); }
        
        .v2-admin-content { display: flex; flex-direction: column; gap: 24px; }
        .v2-admin-toolbar { display: flex; justify-content: flex-end; align-items: center; }
        
        .v2-admin-table-wrapper { background: var(--bg-panel-elevated); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); overflow: hidden; min-height: 200px; position: relative; }
        .v2-admin-loading { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(21, 22, 29, 0.8); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .v2-admin-table { width: 100%; border-collapse: collapse; text-align: left; }
        .v2-admin-table th { padding: 16px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); border-bottom: 1px solid var(--border-strong); background: rgba(0,0,0,0.2); }
        .v2-admin-table td { padding: 16px; border-bottom: 1px solid var(--border-strong); font-size: 0.9375rem; }
        .v2-admin-table tr:last-child td { border-bottom: none; }
        .v2-admin-table tbody tr:hover { background: var(--bg-panel-hover); }
        
        .v2-status-badge { padding: 6px 12px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: var(--bg-panel); color: var(--text-secondary); border: 1px solid var(--border-strong); cursor: pointer; transition: 0.2s; }
        .v2-status-badge:hover { filter: brightness(1.2); }
        .v2-status-badge.active { background: rgba(16, 185, 129, 0.1); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
      `}</style>
    </div>
  )
}
