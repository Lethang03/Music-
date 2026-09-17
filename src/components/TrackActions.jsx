import React, { useState } from 'react'
import { useLibrary } from '../contexts/LibraryContext'
import { useRef, useEffect, memo } from 'react'
import { useStableEvent } from '../lib/useStableEvent'
import { MoreHorizontal } from 'lucide-react'
import './TrackActions.css'
import { useAudio } from '../contexts/AudioContext'
import { mediaKey } from '../lib/storage'
export default function TrackActions({ item }) {
  const { addToQueue, playNext } = useAudio()
  const { playlists, favorites, toggleFavorite, savePlaylist } = useLibrary()
  const enqueue = useStableEvent(addToQueue)
  const next = useStableEvent(playNext)
  const liked = favorites.some(x => mediaKey(x) === mediaKey(item))
  return <TrackActionsMenu item={item} addToQueue={enqueue} playNext={next} playlists={playlists} liked={liked} toggleFavorite={toggleFavorite} savePlaylist={savePlaylist} />
}

const TrackActionsMenu = memo(function TrackActionsMenu({ item, addToQueue, playNext, playlists, liked, toggleFavorite, savePlaylist }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const detailsRef = useRef(null)
  const menuRef = useRef(null)
  const close = (restoreFocus = false) => {
    if (!detailsRef.current) return
    detailsRef.current.open = false
    menuRef.current?.hidePopover?.()
    if (restoreFocus) detailsRef.current.querySelector('summary').focus()
  }
  const positionMenu = () => {
    const details = detailsRef.current
    const menu = menuRef.current
    if (!details?.open || !menu) { menu?.hidePopover?.(); return }
    menu.showPopover?.()
    const anchor = details.querySelector('summary').getBoundingClientRect()
    const bounds = menu.getBoundingClientRect()
    const gutter = 8
    const left = Math.max(gutter, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - gutter))
    const top = anchor.bottom + bounds.height + gutter <= window.innerHeight
      ? anchor.bottom + 6 : Math.max(gutter, anchor.top - bounds.height - 6)
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
  }
  useEffect(() => {
    const outside = e => { if (!detailsRef.current?.contains(e.target)) close() }
    const escape = e => {
      if (e.key === 'Escape' && detailsRef.current?.open) {
        e.preventDefault(); e.stopImmediatePropagation(); close(true)
      }
    }
    const reposition = () => positionMenu()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [])
  const run = async (action, text) => {
    setBusy(true); setMessage('')
    try { await action(); setMessage(text) } catch (err) { setMessage(err.message) }
    finally { setBusy(false) }
  }
  return <details ref={detailsRef} className="v2-track-actions" onToggle={positionMenu} onClick={e => e.stopPropagation()} onKeyDown={e => {
    e.stopPropagation()
    if (e.key === 'Escape' && detailsRef.current.open) { e.preventDefault(); close(true) }
    if (e.key === 'ArrowDown' && e.target.tagName === 'SUMMARY') {
      e.preventDefault(); detailsRef.current.open = true; positionMenu(); menuRef.current.querySelector('button')?.focus()
    }
  }}>
    <summary className="sv-more-button" aria-label={`Actions for ${item.title}`}><MoreHorizontal size={20} aria-hidden="true" /></summary>
    <div ref={menuRef} popover="manual" className="v2-action-menu" aria-label={`Options for ${item.title}`}>
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
})
