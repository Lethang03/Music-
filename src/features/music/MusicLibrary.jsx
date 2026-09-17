import { mediaProvider } from '../../services/media'
import React, { useMemo, useState } from 'react'
import { Grid2X2, List, Play, Search, Heart, Music2 } from 'lucide-react'
import { useLibrary } from '../../contexts/LibraryContext'
import TrackActions from '../../components/TrackActions'
import { useAudio } from '../../contexts/AudioContext'
import TiltCard from '../../components/ui/TiltCard'
import { mediaKey } from '../../lib/storage'
import MusicHero from './MusicHero'
import './MusicLibrary.css'

const formatDuration = value => { const seconds = Number(value) || 0; return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }

export default function MusicLibrary() {
  const { tracks, loading, error, loadPublicLibrary, favorites, toggleFavorite } = useLibrary()
  const { playItem, activeItem } = useAudio()
  const [activeFilter, setActiveFilter] = useState('All')
  const [sort, setSort] = useState('newest')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [collection, setCollection] = useState('all')
  const [actionError, setActionError] = useState('')
  const favoriteKeys = useMemo(() => new Set(favorites.map(mediaKey)), [favorites])
  const like = async (event, track) => { event.stopPropagation(); try { await toggleFavorite(track); setActionError('') } catch { setActionError('Unable to update this favorite. Please retry.') } }
  const favoriteButton = track => <button className="music-favorite" aria-label={`Favorite ${track.title}`} aria-pressed={favoriteKeys.has(mediaKey(track))} onClick={e => like(e, track)} onKeyDown={e => e.stopPropagation()}><Heart size={18} fill={favoriteKeys.has(mediaKey(track)) ? 'currentColor' : 'none'}/></button>
  const genres = useMemo(() => ['All', ...new Set(tracks.map(t => t.genre).filter(Boolean))], [tracks])
  const filtered = useMemo(() => {
    const newest = (a, b) => (b.created_at || '').localeCompare(a.created_at || '')
    const collectionTracks = collection === 'recent' ? [...tracks].sort(newest).slice(0, 20) : tracks
    return collectionTracks.filter(t => collection !== 'favorites' || favoriteKeys.has(mediaKey(t)))
      .filter(t => activeFilter === 'All' || t.genre === activeFilter)
      .filter(t => `${t.title || ''} ${t.artist || ''} ${t.album || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => sort === 'newest' ? newest(a, b) : (a[sort] || '').localeCompare(b[sort] || ''))
  }, [tracks, activeFilter, query, sort, collection, favoriteKeys])
  if (loading) return <div className="v2-page music-library" aria-busy="true"><p role="status">Loading your music…</p><div className="music-skeletons">{Array.from({ length: 6 }, (_, i) => <div key={i}/>)}</div></div>
  return <div className="v2-page v2-animate-fade music-library">
    <MusicHero tracks={tracks} />
    {error && <div className="music-error"><p>Music could not be fully loaded. Check your connection.</p><button className="v2-btn-secondary" onClick={loadPublicLibrary}>Retry</button></div>}
    {actionError && <p role="alert">{actionError}</p>}
    <div className="music-collection-tabs" aria-label="Music collection">{[['all','All music'],['recent','Recently Added'],['favorites','Favorites']].map(([id,label]) => <button key={id} aria-pressed={collection === id} onClick={() => setCollection(id)}>{label}</button>)}</div>
    <div className="music-toolbar"><label className="music-search"><Search size={18}/><input aria-label="Search music" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search songs, artists, albums" /></label><label className="music-sort">Sort <select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="title">Title</option><option value="artist">Artist</option></select></label><div className="view-toggle" aria-label="Music view"><button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={18}/></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={19}/></button></div></div>
    <div className="v2-filter-row" role="tablist" aria-label="Genre filter">{genres.map(f => <button key={f} role="tab" aria-selected={activeFilter === f} className={`v2-filter-pill ${activeFilter === f ? 'active' : ''}`} onClick={() => setActiveFilter(f)}>{f}</button>)}</div>
    <div className="music-results-label"><h2>{collection === 'favorites' ? 'Your favorites' : collection === 'recent' ? 'Fresh arrivals' : 'Explore the catalog'}</h2><span>{filtered.length} tracks</span></div>
    {filtered.length ? view === 'grid' ? <div className="v2-premium-grid">{filtered.map((track, i) => <TiltCard key={track.id} className={`v2-premium-card ${activeItem?.id === track.id ? 'is-playing' : ''}`} onClick={() => playItem(track, filtered, i)} role="button" tabIndex={0} aria-label={`Play ${track.title}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playItem(track, filtered, i) } }}><div className="v2-card-artwork"><img src={mediaProvider.getCoverUrl(track.image_url || track.cover_url || '/icons/icon.svg')} alt="" loading="lazy" decoding="async"/><div className="v2-card-overlay"><span className="v2-card-play-btn"><Play size={22} fill="currentColor"/></span></div>{activeItem?.id === track.id && <span className="music-playing-badge">Now playing</span>}</div><div className="v2-card-meta"><strong>{track.title}</strong><span>{track.artist || 'Unknown artist'}</span><small>{track.album || 'Single'}</small></div><div className="music-card-footer"><time>{formatDuration(track.duration)}</time>{favoriteButton(track)}<TrackActions item={track}/></div></TiltCard>)}</div> : <div className="music-list"><div className="music-list-head"><span>#</span><span>Title / Artist</span><span>Album</span><span>Time</span><span></span></div>{filtered.map((track, i) => <div key={track.id} className={`music-list-row ${activeItem?.id === track.id ? 'is-playing' : ''}`}><button className="track-number" onClick={() => playItem(track, filtered, i)} aria-label={`Play ${track.title}`}><span>{String(i + 1).padStart(2, '0')}</span><Play size={15} fill="currentColor"/></button><button className="music-title-cell" onClick={() => playItem(track, filtered, i)}><img src={mediaProvider.getCoverUrl(track.image_url || track.cover_url || '/icons/icon.svg')} alt="" loading="lazy" decoding="async"/><span><strong>{track.title}</strong><small>{track.artist || 'Unknown artist'}</small></span></button><span className="album-cell">{track.album || 'Single'}</span><span className="music-duration">{formatDuration(track.duration)}</span><div className="music-row-actions">{favoriteButton(track)}<TrackActions item={track}/></div></div>)}</div> : <div className="v2-music-empty"><Music2 size={32}/><h2>{tracks.length ? 'No tracks found' : 'Your next favorite is on its way'}</h2><p>{tracks.length ? 'Try another search, collection or genre.' : 'New music will appear here as tracks are published.'}</p>{tracks.length > 0 && <button className="v2-btn-secondary" onClick={() => { setQuery(''); setActiveFilter('All'); setCollection('all') }}>Clear filters</button>}</div>}
  </div>
}
