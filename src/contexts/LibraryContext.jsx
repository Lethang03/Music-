import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase, supabaseReady } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { readStored, writeStored, mediaKey } from '../lib/storage'
import { fetchRows } from '../lib/fetchRows'
import { activityPayload } from '../lib/activityPayload'
const LibraryContext = createContext()
export function LibraryProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [catalog, setCatalog] = useState({ podcasts: [], episodes: [], tracks: [], playlists: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [activity, setActivity] = useState({})
  const activityRef = useRef({})
  const dirty = useRef(new Set())
  const currentUser = useRef(userId)
  currentUser.current = userId
  const requestId = useRef(0)
  const catalogRequest = useRef(null)
  const cleared = useRef(false)
  const storageKey = `soundverse_activity:${userId}`
  const saveLocal = useCallback(() => {
    if (!userId || cleared.current) return
    if (!writeStored(storageKey, { rows: activityRef.current, dirty: [...dirty.current] })) setSyncError('Browser storage is full or unavailable. Keep this page open until cloud sync succeeds.')
  }, [storageKey, userId])
  const syncing = useRef(null)
  const syncActivity = useCallback(() => {
    if (syncing.current) return syncing.current
    if (!userId || !supabaseReady || cleared.current || !dirty.current.size) return Promise.resolve()
    const snapshot = new Map([...dirty.current].map(key => [key, activityRef.current[key]]))
    const pending = [...snapshot.values()].filter(Boolean).map(row => activityPayload(row, userId))
    syncing.current = (async () => {
    try {
      const { error } = await supabase.from('soundverse_activity').upsert(pending, { onConflict: 'user_id,media_key' })
      if (currentUser.current !== userId || cleared.current) return
      if (error) throw error
      pending.forEach(row => {
        if (activityRef.current[row.media_key] === snapshot.get(row.media_key)) dirty.current.delete(row.media_key)
      })
      setSyncError(''); saveLocal()
    } catch (err) {
      if (currentUser.current === userId && !cleared.current) setSyncError(`Listening activity is saved on this browser; cloud sync failed: ${err.message}`)
    } finally { syncing.current = null }
    })()
    return syncing.current
  }, [userId, saveLocal])
  const loadPublicLibrary = useCallback(async () => {
    const request = ++requestId.current
    catalogRequest.current?.abort()
    const controller = new AbortController()
    catalogRequest.current = controller
    if (!supabaseReady || !userId) { setCatalog({ podcasts: [], episodes: [], tracks: [], playlists: [] }); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const tables = ['podcasts', 'episodes', 'music_tracks', 'playlists']
      const results = await Promise.all(tables.map(table => fetchRows(() => {
        let query = supabase.from(table).select('*')
        query = table === 'playlists' ? query.eq('user_id', userId) : query.eq('published', true)
        return query.order(table === 'episodes' ? 'published_at' : 'created_at', { ascending: false }).order('id')
      }, controller.signal)))
      if (request !== requestId.current || currentUser.current !== userId || cleared.current) return
      const failures = results.flatMap((result, index) => result.error ? [`${tables[index]}: ${result.error.message}`] : [])
      setError(failures.join(' · '))
      const [p, e, t, pl] = results.map(result => result.data || [])
      setCatalog({ podcasts: p.map(x => ({ ...x, image: x.cover_url || x.image })), episodes: e.map(x => ({ ...x, type: 'episode' })), tracks: t, playlists: pl })
    } catch (err) { if (request === requestId.current) setError(err.message) }
    finally { if (request === requestId.current) setLoading(false) }
  }, [userId])
  useEffect(() => { loadPublicLibrary(); return () => { requestId.current++; catalogRequest.current?.abort() } }, [loadPublicLibrary])
  useEffect(() => {
    const saved = userId ? readStored(storageKey, { rows: {}, dirty: [] }) : { rows: {}, dirty: [] }
    activityRef.current = saved.rows && typeof saved.rows === 'object' ? saved.rows : {}
    dirty.current = new Set(Array.isArray(saved.dirty) ? saved.dirty : [])
    setActivity({ ...activityRef.current }); setSyncError('')
    if (!userId || !supabaseReady) return
    let cancelled = false
    const controller = new AbortController()
    fetchRows(() => supabase.from('soundverse_activity').select('*').eq('user_id', userId).order('media_key'), controller.signal).then(({ data, error }) => {
      if (cancelled || cleared.current) return
      if (error) { setSyncError(`Cloud activity is unavailable: ${error.message}`); return }
      for (const row of data || []) {
        const local = activityRef.current[row.media_key]
        if (!local || (!dirty.current.has(row.media_key) && row.updated_at > local.updated_at)) activityRef.current[row.media_key] = row
      }
      setActivity({ ...activityRef.current }); saveLocal(); syncActivity()
    }).catch(err => { if (!cancelled) setSyncError(err.message) })
    const timer = setInterval(() => { if (!cleared.current) { saveLocal(); setActivity({ ...activityRef.current }); syncActivity() } }, 10000)
    window.addEventListener('pagehide', saveLocal)
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener('pagehide', saveLocal); saveLocal() }
  }, [userId, storageKey, saveLocal, syncActivity])
  useEffect(() => {
    const clear = () => {
      cleared.current = true
      try { localStorage.removeItem(storageKey) } catch { /* Logout works without storage. */ }
      setActivity({}); setCatalog({ podcasts: [], episodes: [], tracks: [], playlists: [] })
    }
    window.addEventListener('auth_cleared', clear)
    const flush = event => { event.detail?.pending?.push((async () => { await syncActivity(); await syncActivity() })()) }
    window.addEventListener('auth_signout', flush)
    return () => { window.removeEventListener('auth_cleared', clear); window.removeEventListener('auth_signout', flush) }
  }, [storageKey, syncActivity])
  const recordProgress = useCallback((item, position, duration, done = false, elapsed = 0) => {
    if (!userId || cleared.current) return
    const key = mediaKey(item)
    const old = activityRef.current[key] || {}
    // Ignore mere source loading/restoration. Count listening only while media advances.
    if (!old.played_at && elapsed <= 0 && !done) return
    const now = new Date().toISOString()
    activityRef.current[key] = { ...old, user_id: userId, media_key: key, item, position: Number.isFinite(position) ? position : 0, duration: Number.isFinite(duration) ? duration : 0,
      completed: done || (duration > 0 && position >= duration - 1), liked: old.liked || false,
      listened_seconds: (old.listened_seconds || 0) + elapsed,
      played_at: elapsed > 0 || done ? now : old.played_at,
      listening_days: elapsed > 0 ? [...new Set([...(old.listening_days || []), now.slice(0, 10)])].slice(-366) : old.listening_days || [], updated_at: now }
    dirty.current.add(key)
    if (done || elapsed === 0) { saveLocal(); setActivity({ ...activityRef.current }) }
  }, [userId, saveLocal])
  const getResumeTime = useCallback(item => {
    const row = activityRef.current[mediaKey(item)]
    return (item.type === 'episode' || item.podcast_id) && !row?.completed ? row?.position || 0 : 0
  }, [])
  const toggleFavorite = async item => {
    if (!userId) throw new Error('Please sign in to save favorites.')
    const key = mediaKey(item)
    const old = activityRef.current[key] || { user_id: userId, media_key: key, item, position: 0, duration: 0, listened_seconds: 0, listening_days: [] }
    activityRef.current[key] = { ...old, liked: !old.liked, updated_at: new Date().toISOString() }
    dirty.current.add(key); saveLocal(); setActivity({ ...activityRef.current }); await syncActivity()
  }
  const savePlaylist = async (fields, id = null) => {
    if (!userId) throw new Error('Please sign in again.')
    const existing = catalog.playlists.find(p => p.id === id)
    let query
    if (id) {
      const versioned = Number.isInteger(existing?.revision)
      query = supabase.from('playlists').update({ ...fields, ...(versioned ? { revision: existing.revision + 1 } : {}) }).eq('id', id).eq('user_id', userId)
      if (versioned) query = query.eq('revision', existing.revision)
    } else query = supabase.from('playlists').insert({ ...fields, user_id: userId })
    const { data, error } = await query.select().single()
    if (error) throw new Error(error.code === 'PGRST116' ? 'This playlist changed elsewhere. Refresh before saving again.' : error.message)
    if (!data?.id) throw new Error('This playlist changed elsewhere. Refresh before saving again.')
    if (currentUser.current === userId) setCatalog(c => ({ ...c, playlists: id ? c.playlists.map(p => p.id === id ? data : p) : [data, ...c.playlists] }))
    return data
  }
  const deletePlaylist = async id => {
    const { data, error } = await supabase.from('playlists').delete().eq('id', id).eq('user_id', userId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Playlist was not deleted. Refresh and check ownership.')
    if (currentUser.current === userId) setCatalog(c => ({ ...c, playlists: c.playlists.filter(p => p.id !== id) }))
  }
  const history = useMemo(() => Object.values(activity).filter(row => row?.item?.id && typeof row.played_at === 'string').sort((a, b) => b.played_at.localeCompare(a.played_at)), [activity])
  const favorites = useMemo(() => Object.values(activity).filter(row => row?.liked && row.item?.id).map(row => row.item), [activity])
  const progress = useMemo(() => Object.fromEntries(history.map(row => [row.item.id, { pct: row.duration ? Math.min(100, row.position / row.duration * 100) : 0, done: row.completed }])), [history])
  return <LibraryContext.Provider value={{ ...catalog, loading, error, syncError, history, favorites, progress, activity, recordProgress, getResumeTime, toggleFavorite, syncActivity, loadPublicLibrary, savePlaylist, deletePlaylist }}>{children}</LibraryContext.Provider>
}
export const useLibrary = () => {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
