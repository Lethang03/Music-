import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { uploadMedia } from '../../../lib/upload'
import { useAuth } from '../../../contexts/AuthContext'
import { useLibrary } from '../../../contexts/LibraryContext'

export default function AdminPodcasts() {
  const { session } = useAuth()
  const { loadPublicLibrary } = useLibrary()
  const [podcasts, setPodcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const fileInputRef = useRef(null)

  const loadPodcasts = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('podcasts').select('*, episodes(count)').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setPodcasts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPodcasts() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let finalCover = form.cover_url

      if (form.newCoverFile) {
        finalCover = await uploadMedia(form.newCoverFile, 'covers')
      }

      const payload = {
        title: form.title.trim(),
        author: form.author?.trim() || null,
        description: form.description?.trim() || null,
        category: form.category?.trim() || null,
        cover_url: finalCover || null,
        published: !!form.published
      }

      if (form.id) {
        const { error } = await supabase.from('podcasts').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        payload.owner_id = session.user.id
        const { error } = await supabase.from('podcasts').insert(payload)
        if (error) throw error
      }

      setForm(null)
      await loadPodcasts()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (podcast) => {
    if (!window.confirm(`Delete podcast "${podcast.title}"? This will delete all episodes within it! This action cannot be undone.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('podcasts').delete().eq('id', podcast.id)
      if (error) throw error
      await loadPodcasts()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePublish = async (podcast) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('podcasts').update({ published: !podcast.published }).eq('id', podcast.id)
      if (error) throw error
      await loadPodcasts()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filtered = podcasts.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()) || p.author?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="v2-admin-section-page">
      <div className="v2-admin-toolbar">
        <input 
          type="search" 
          placeholder="Search podcasts..." 
          className="v2-admin-search" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <button className="v2-admin-btn-primary" onClick={() => setForm({ title: '', published: false })} disabled={busy}>
          + Add Podcast
        </button>
      </div>

      {error && <div className="v2-status-banner error" role="alert">{error}</div>}

      {loading ? (
        <div className="v2-admin-loading">Loading podcasts...</div>
      ) : (
        <div className="v2-admin-table-wrapper">
          <table className="v2-admin-table">
            <thead>
              <tr>
                <th>Podcast</th>
                <th>Category</th>
                <th>Episodes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="v2-admin-cell-flex">
                      <img src={p.cover_url || ''} alt="" className="v2-admin-thumb-sm" />
                      <div>
                        <strong>{p.title}</strong>
                        <small>{p.author}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.category || '-'}</td>
                  <td>{p.episodes?.[0]?.count || 0}</td>
                  <td>
                    <span className={`v2-badge ${p.published ? 'success' : 'neutral'}`}>
                      {p.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className="v2-admin-actions">
                      <button onClick={() => handleTogglePublish(p)} disabled={busy} className="v2-admin-btn-text">
                        {p.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => setForm({ ...p })} disabled={busy} className="v2-admin-btn-text">Edit</button>
                      <button onClick={() => handleDelete(p)} disabled={busy} className="v2-admin-btn-text danger">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="v2-admin-empty">No podcasts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="v2-modal-overlay">
          <form className="v2-modal-content admin-modal" onSubmit={handleSave}>
            <h2>{form.id ? 'Edit Podcast' : 'Add Podcast'}</h2>
            
            <div className="v2-form-grid">
              <label>Title *
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={busy} />
              </label>
              <label>Author / Host
                <input value={form.author || ''} onChange={e => setForm({...form, author: e.target.value})} disabled={busy} />
              </label>
              <label>Category
                <input value={form.category || ''} onChange={e => setForm({...form, category: e.target.value})} disabled={busy} />
              </label>
              <label className="full-width">Description
                <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} disabled={busy} rows="3" />
              </label>

              <div className="v2-file-group full-width">
                <label>Artwork (Upload or URL)
                  <div className="v2-file-input-wrapper">
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={e => setForm({...form, newCoverFile: e.target.files[0]})} disabled={busy} />
                    <input type="url" placeholder="Or paste cover URL..." value={form.cover_url || ''} onChange={e => setForm({...form, cover_url: e.target.value})} disabled={busy || !!form.newCoverFile} />
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
              <button type="submit" disabled={busy || !form.title?.trim()} className="v2-admin-btn-primary">
                {busy ? 'Saving...' : 'Save Podcast'}
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

