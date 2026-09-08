import React, { useState } from 'react'
import { useLibrary } from '../contexts/LibraryContext'
import { useAudio } from '../contexts/AudioContext'
import { mediaKey } from '../lib/storage'
export default function TrackActions({ item }) {
  const { addToQueue, playNext } = useAudio()
  const { playlists, favorites, toggleFavorite, savePlaylist } = useLibrary()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const liked = favorites.some(x => mediaKey(x) === mediaKey(item))
  const run = async (action, text) => {
    setBusy(true); setMessage('')
    try { await action(); setMessage(text) } catch (err) { setMessage(err.message) }
    finally { setBusy(false) }
  }
  return <details className="v2-track-actions" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <summary aria-label={`Actions for ${item.title}`}>•••</summary>
    <div className="v2-action-menu">
      <button disabled={busy} onClick={() => run(() => addToQueue(item), 'Added to queue')}>Add to queue</button>
      <button disabled={busy} onClick={() => run(() => playNext(item), 'Will play next')}>Play next</button>
      <button disabled={busy} aria-pressed={liked} onClick={() => run(() => toggleFavorite(item), 'Favorite updated')}>{liked ? 'Remove favorite' : 'Favorite'}</button>
      {!item.podcast_id && item.type !== 'episode' && <label>Add to playlist<select aria-label={`Add ${item.title} to playlist`} defaultValue="" disabled={busy} onChange={e => {
        const playlist = playlists.find(p => p.id === e.target.value)
        e.target.value = ''
        if (playlist) run(() => savePlaylist({ track_ids: [...new Set([...(playlist.track_ids || []), item.id])] }, playlist.id), 'Saved to playlist')
      }}><option value="">Choose playlist</option>{playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {message && <small role="status">{message}</small>}
    </div>
  </details>
}
