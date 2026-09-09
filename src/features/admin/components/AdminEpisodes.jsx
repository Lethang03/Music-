import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { uploadMedia } from '../../../lib/upload'
import { useAuth } from '../../../contexts/AuthContext'
import { useLibrary } from '../../../contexts/LibraryContext'

export default function AdminEpisodes() {
  const { session } = useAuth()
  const { loadPublicLibrary } = useLibrary()
  const [episodes, setEpisodes] = useState([])
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const fileInputRef = useRef(null)
  const audioInputRef = useRef(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [eps, pods] = await Promise.all([
        supabase.from('episodes').select('*, podcasts(title)').order('season_number', { ascending: false, nullsFirst: false }).order('episode_number', { ascending: false, nullsFirst: false }),
        supabase.from('podcasts').select('id, title').order('title')
      ])
      if (eps.error) throw eps.error
      if (pods.error) throw pods.error
      setEpisodes(eps.data || [])
      setPodcasts(pods.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let finalAudio = form.audio_url

      if (form.newAudioFile) {
        finalAudio = await uploadMedia(form.newAudioFile, 'audio')
      }

      if (!finalAudio) throw new Error("Audio URL or file is required")
      if (!form.podcast_id) throw new Error("Please select a podcast")

      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        podcast_id: form.podcast_id,
        audio_url: finalAudio,
        duration: form.duration ? Number(form.duration) : null,
        season_number: form.season_number ? Number(form.season_number) : null,
        episode_number: form.episode_number ? Number(form.episode_number) : null,
        published: !!form.published
      }

      if (form.id) {
        const { error } = await supabase.from('episodes').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('episodes').insert(payload)
        if (error) throw error
      }

      setForm(null)
      await loadData()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (episode) => {
    if (!window.confirm(`Delete episode "${episode.title}"? This action cannot be undone.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('episodes').delete().eq('id', episode.id)
      if (error) throw error
      await loadData()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePublish = async (episode) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('episodes').update({ published: !episode.published }).eq('id', episode.id)
      if (error) throw error
      await loadData()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filtered = episodes.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()) || e.podcasts?.title?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="v2-admin-section-page">
      <div className="v2-admin-toolbar">
        <input 
          type="search" 
          placeholder="Search episodes..." 
          className="v2-admin-search" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <button className="v2-admin-btn-primary" onClick={() => setForm({ title: '', published: false })} disabled={busy}>
          + Add Episode
        </button>
      </div>

      {error && <div className="v2-status-banner error" role="alert">{error}</div>}

      {loading ? (
        <div className="v2-admin-loading">Loading episodes...</div>
      ) : (
        <div className="v2-admin-table-wrapper">
          <table className="v2-admin-table">
            <thead>
              <tr>
                <th>Episode Title</th>
                <th>Podcast</th>
                <th>S / E</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.title}</strong>
                  </td>
                  <td>{e.podcasts?.title || '-'}</td>
                  <td>
                    {e.season_number ? `S${e.season_number}` : ''} {e.episode_number ? `E${e.episode_number}` : ''}
                  </td>
                  <td>
                    <span className={`v2-badge ${e.published ? 'success' : 'neutral'}`}>
                      {e.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className="v2-admin-actions">
                      <button onClick={() => handleTogglePublish(e)} disabled={busy} className="v2-admin-btn-text">
                        {e.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => setForm({ ...e })} disabled={busy} className="v2-admin-btn-text">Edit</button>
                      <button onClick={() => handleDelete(e)} disabled={busy} className="v2-admin-btn-text danger">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="v2-admin-empty">No episodes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="v2-modal-overlay">
          <form className="v2-modal-content admin-modal" onSubmit={handleSave}>
            <h2>{form.id ? 'Edit Episode' : 'Add Episode'}</h2>
            
            <div className="v2-form-grid">
              <label>Title *
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={busy} />
              </label>
              
              <label>Podcast *
                <select required value={form.podcast_id || ''} onChange={e => setForm({...form, podcast_id: e.target.value})} disabled={busy}>
                  <option value="">Select a podcast...</option>
                  {podcasts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>

              <label>Season Number
                <input type="number" min="1" value={form.season_number || ''} onChange={e => setForm({...form, season_number: e.target.value})} disabled={busy} />
              </label>
              <label>Episode Number
                <input type="number" min="1" value={form.episode_number || ''} onChange={e => setForm({...form, episode_number: e.target.value})} disabled={busy} />
              </label>

              <label>Duration (seconds)
                <input type="number" min="0" value={form.duration || ''} onChange={e => setForm({...form, duration: e.target.value})} disabled={busy} />
              </label>

              <label className="full-width">Description
                <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} disabled={busy} rows="3" />
              </label>
              
              <div className="v2-file-group full-width">
                <label>Audio File (Upload or URL) *
                  <div className="v2-file-input-wrapper">
                    <input type="file" accept="audio/*" ref={audioInputRef} onChange={e => setForm({...form, newAudioFile: e.target.files[0]})} disabled={busy} />
                    <input type="url" placeholder="Or paste audio URL..." value={form.audio_url || ''} onChange={e => setForm({...form, audio_url: e.target.value})} disabled={busy || !!form.newAudioFile} />
                  </div>
                </label>
              </div>
            </div>

            <label className="v2-checkbox-label">
              <input type="checkbox" checked={!!form.published} onChange={e => setForm({...form, published: e.target.checked})} disabled={busy} />
              Publish immediately
            </label>

            {error && <p className="v2-status-banner error" role="alert">{error}</p>}
            
            <div className="v2-action-row">
              <button type="submit" disabled={busy || !form.title?.trim() || (!form.audio_url && !form.newAudioFile) || !form.podcast_id} className="v2-admin-btn-primary">
                {busy ? 'Saving...' : 'Save Episode'}
              </button>
              <button type="button" disabled={busy} className="v2-admin-btn-secondary" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

