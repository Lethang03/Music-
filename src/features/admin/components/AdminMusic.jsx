import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { uploadMedia } from '../../../lib/upload'
import { useAuth } from '../../../contexts/AuthContext'
import { useLibrary } from '../../../contexts/LibraryContext'
import TrackForm from './TrackForm'

export default function AdminMusic() {
  const { session } = useAuth()
  const { loadPublicLibrary } = useLibrary()
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null) // null = list mode, object = edit/add mode
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  const loadTracks = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('music_tracks').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTracks(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTracks() }, [])

  const handleSave = async (payloadWithFiles) => {
    setBusy(true)
    setError('')
    setUploadProgress(0)
    try {
      let finalCover = payloadWithFiles.cover_url
      let finalAudio = payloadWithFiles.audio_url

      if (payloadWithFiles.newCoverFile) {
        finalCover = await uploadMedia(payloadWithFiles.newCoverFile, 'covers')
      }
      if (payloadWithFiles.newAudioFile) {
        finalAudio = await uploadMedia(payloadWithFiles.newAudioFile, 'audio', setUploadProgress)
      }

      const payload = {
        title: payloadWithFiles.title,
        artist: payloadWithFiles.artist || null,
        album: payloadWithFiles.album || null,
        genre: payloadWithFiles.genre || null,
        release_date: payloadWithFiles.release_date || null,
        track_number: payloadWithFiles.track_number ? Number(payloadWithFiles.track_number) : null,
        duration: payloadWithFiles.duration ? Number(payloadWithFiles.duration) : null,
        explicit_content: payloadWithFiles.explicit_content,
        description: payloadWithFiles.description || null,
        lyrics: payloadWithFiles.lyrics || null,
        audio_url: finalAudio,
        cover_url: finalCover || null,
        published: payloadWithFiles.published
      }

      if (payloadWithFiles.id) {
        const { error } = await supabase.from('music_tracks').update(payload).eq('id', payloadWithFiles.id)
        if (error) throw error
      } else {
        payload.owner_id = session.user.id
        const { error } = await supabase.from('music_tracks').insert(payload)
        if (error) throw error
      }

      setForm(null)
      await loadTracks()
      await loadPublicLibrary()
      
      // Temporary toast
      const toast = document.createElement('div')
      toast.className = 'v2-toast-success'
      toast.textContent = 'Track saved successfully'
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (track) => {
    if (!window.confirm(`Delete "${track.title}"? This action cannot be undone.`)) return
    setBusy(true)
    try {
      const { error } = await supabase.from('music_tracks').delete().eq('id', track.id)
      if (error) throw error
      await loadTracks()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePublish = async (track) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('music_tracks').update({ published: !track.published }).eq('id', track.id)
      if (error) throw error
      await loadTracks()
      await loadPublicLibrary()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filtered = tracks.filter(t => t.title?.toLowerCase().includes(search.toLowerCase()) || t.artist?.toLowerCase().includes(search.toLowerCase()))

  if (form) {
    return (
      <div className="v2-admin-full-page">
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="v2-upload-progress-bar">
            <div className="v2-upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
            <span>Uploading... {uploadProgress}%</span>
          </div>
        )}
        {error && <div className="v2-status-banner error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
        <TrackForm 
          initialData={form.id ? form : null} 
          onSave={(data) => handleSave({ ...data, id: form.id })} 
          onCancel={() => setForm(null)} 
          busy={busy}
        />
      </div>
    )
  }

  return (
    <div className="v2-admin-section-page">
      <div className="v2-admin-toolbar">
        <input 
          type="search" 
          placeholder="Search tracks..." 
          className="v2-admin-search" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <button className="v2-admin-btn-primary" onClick={() => setForm({ title: '', published: false })} disabled={busy}>
          + Add Track
        </button>
      </div>

      {error && <div className="v2-status-banner error" role="alert">{error}</div>}

      {loading ? (
        <div className="v2-admin-loading">Loading tracks...</div>
      ) : (
        <div className="v2-admin-table-wrapper">
          <table className="v2-admin-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Album</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className="v2-admin-cell-flex">
                      <img src={t.cover_url || ''} alt="" className="v2-admin-thumb-sm" />
                      <div>
                        <strong>{t.title}</strong>
                        <small>{t.artist}</small>
                      </div>
                    </div>
                  </td>
                  <td>{t.album || '-'}</td>
                  <td>
                    <span className={`v2-badge ${t.published ? 'success' : 'neutral'}`}>
                      {t.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <div className="v2-admin-actions">
                      <button onClick={() => handleTogglePublish(t)} disabled={busy} className="v2-admin-btn-text">
                        {t.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => setForm({ ...t })} disabled={busy} className="v2-admin-btn-text">Edit</button>
                      <button onClick={() => handleDelete(t)} disabled={busy} className="v2-admin-btn-text danger">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="v2-admin-empty">No tracks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

