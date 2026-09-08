import React, { useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDialog } from '../../lib/useDialog'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAudio } from '../../contexts/AudioContext'
import { validUrl } from '../../lib/storage'
import TrackActions from '../../components/TrackActions'
export default function LibraryPage() {
  const { playlists, tracks, history, favorites, loading, savePlaylist, deletePlaylist } = useLibrary()
  const { playItem } = useAudio()
  const [params, setParams] = useSearchParams()
  const selected = playlists.find(p => p.id === params.get('playlist'))
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  useDialog(dialogRef, () => { if (!busy) setForm(null) }, !!form)
  const run = async action => {
    setBusy(true); setError('')
    try { await action() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const items = selected ? (selected.track_ids || []).map(id => tracks.find(t => t.id === id)).filter(Boolean) : []
  const reorder = (index, offset) => {
    const ids = [...(selected.track_ids || [])]
    const source = ids.indexOf(items[index].id), target = ids.indexOf(items[index + offset]?.id)
    if (target < 0) return
    ;[ids[source], ids[target]] = [ids[target], ids[source]]
    run(() => savePlaylist({ track_ids: ids }, selected.id))
  }
  return <div className="v2-page v2-animate-fade">
    <header className="v2-page-header"><h1>Your Library</h1><p>Your collections and listening activity.</p></header>
    {error && <div role="alert" className="v2-status-banner">{error}</div>}
    <section className="v2-section"><div className="v2-section-hdr"><h2>Playlists</h2><button className="v2-btn-primary" onClick={() => setForm({ name: '', description: '', cover_url: '' })}>Create playlist</button></div>
      {loading && <p role="status">Loading playlists…</p>}
      <div className="v2-premium-grid">{playlists.map(p => <button key={p.id} className="v2-premium-card" onClick={() => setParams({ playlist: p.id })}>
        <div className="v2-card-artwork">{p.cover_url ? <img src={p.cover_url} alt="" loading="lazy" /> : <div className="v2-art-placeholder">♫</div>}</div>
        <strong>{p.name}</strong><span>{(p.track_ids || []).length} songs</span>
      </button>)}</div>
      {!loading && !playlists.length && <p>Create a playlist to collect your favorite songs.</p>}
    </section>
    {selected && <section className="v2-section v2-collection-panel">
      <h2>{selected.name}</h2><p>{selected.description}</p>
      <div className="v2-action-row">
        <button className="v2-btn-primary" disabled={!items.length} onClick={() => playItem(items[0], items, 0)}>Play playlist</button>
        <button className="v2-btn-secondary" disabled={busy} onClick={() => setForm({ ...selected })}>Edit playlist</button>
        <button className="v2-btn-secondary" disabled={busy} onClick={() => { if (window.confirm(`Delete playlist “${selected.name}”?`)) run(async () => { await deletePlaylist(selected.id); setParams({}) }) }}>Delete playlist</button>
      </div>
      <label>Add song<select aria-label="Add song" value="" disabled={busy} onChange={e => { if (e.target.value) run(() => savePlaylist({ track_ids: [...(selected.track_ids || []), e.target.value] }, selected.id)) }}>
        <option value="">Choose a song</option>{tracks.filter(t => !(selected.track_ids || []).includes(t.id)).map(t => <option value={t.id} key={t.id}>{t.title} — {t.artist}</option>)}
      </select></label>
      {items.map((item, i) => <div className="v2-media-row" key={item.id}>
        <button className="v2-row-title" onClick={() => playItem(item, items, i)}>{item.title}<small>{item.artist}</small></button>
        <button aria-label={`Move ${item.title} up`} disabled={busy || i === 0} onClick={() => reorder(i, -1)}>↑</button>
        <button aria-label={`Move ${item.title} down`} disabled={busy || i === items.length - 1} onClick={() => reorder(i, 1)}>↓</button>
        <button aria-label={`Remove ${item.title}`} disabled={busy} onClick={() => run(() => savePlaylist({ track_ids: selected.track_ids.filter(id => id !== item.id) }, selected.id))}>Remove</button>
      </div>)}
      {!items.length && <p>No playable songs yet. Add a song above.</p>}
      {(selected.track_ids || []).filter(id => !tracks.some(t => t.id === id)).map(id => <div className="v2-media-row" key={id}><span>Song no longer available</span><button disabled={busy} onClick={() => run(() => savePlaylist({ track_ids: selected.track_ids.filter(x => x !== id) }, selected.id))}>Remove unavailable song</button></div>)}
    </section>}
    <section className="v2-section"><h2>Favorite content</h2>{favorites.map((item, i) => <div key={`${item.type}:${item.id}`} className="v2-media-row"><button className="v2-row-title" onClick={() => playItem(item, favorites, i)}>{item.title}<small>{item.artist || item.author}</small></button><TrackActions item={item} /></div>)}{!favorites.length && <p>Use Favorite on a song or episode to save it here.</p>}</section>
    <section className="v2-section"><h2>Listening history</h2>{history.slice(0, 50).map(row => <div key={row.media_key} className="v2-media-row"><button className="v2-row-title" onClick={() => playItem(row.item, null, 0, row.completed ? 0 : row.position)}>{row.item.title}<small>{row.item.podcast_id ? 'Podcast' : 'Music'} · {new Date(row.played_at).toLocaleString()} · {Math.floor(row.position)}s listened to</small></button><TrackActions item={row.item} /></div>)}{!history.length && <p>Play something to start your listening history.</p>}</section>
    {form && <div className="v2-modal-overlay"><form ref={dialogRef} className="v2-modal-content" role="dialog" aria-modal="true" aria-label={form.id ? 'Edit playlist' : 'Create playlist'} onSubmit={e => { e.preventDefault(); run(async () => {
      if (!validUrl(form.cover_url)) throw new Error('Use an HTTP or HTTPS cover image URL.')
      const saved = await savePlaylist({ name: form.name.trim(), description: form.description || '', cover_url: form.cover_url || null }, form.id)
      setForm(null); setParams({ playlist: saved.id })
    }) }}><h2>{form.id ? 'Edit playlist' : 'Create playlist'}</h2>
      <label>Name<input autoFocus required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Description<textarea maxLength={2000} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label>Cover image URL<input type="url" value={form.cover_url || ''} onChange={e => setForm({ ...form, cover_url: e.target.value })} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="v2-action-row"><button className="v2-btn-primary" disabled={busy || !form.name.trim()}>Save playlist</button><button type="button" className="v2-btn-secondary" disabled={busy} onClick={() => { setForm(null); setError('') }}>Cancel</button></div>
    </form></div>}
  </div>
}
