import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, supabaseReady } from '../lib/supabase'
import { useAuth } from './AuthContext'

const LibraryContext = createContext()

export function LibraryProvider({ children }) {
  const { session } = useAuth()
  const [podcasts,  setPodcasts]  = useState([])
  const [episodes,  setEpisodes]  = useState([])
  const [tracks,    setTracks]    = useState([])
  const [playlists, setPlaylists] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [history,   setHistory]   = useState([])
  const [progress,  setProgress]  = useState({})

  const loadPublicLibrary = useCallback(async () => {
    // Without Supabase or a session, there's nothing to load
    if (!supabaseReady || !session?.user) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const [
        { data: p, error: pe },
        { data: e, error: ee },
        { data: t, error: te },
        { data: pl, error: ple }
      ] = await Promise.all([
        supabase.from('podcasts').select('*').eq('published', true).order('created_at', { ascending: false }),
        supabase.from('episodes').select('*').eq('published', true).order('published_at', { ascending: false }),
        supabase.from('music_tracks').select('*').eq('published', true).order('created_at', { ascending: false }),
        supabase.from('playlists').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      ])

      if (pe) console.error('[Library] podcasts error:', pe.message)
      if (ee) console.error('[Library] episodes error:', ee.message)
      if (te) console.error('[Library] tracks error:', te.message)
      if (ple) console.error('[Library] playlists error:', ple.message)

      if (p)  setPodcasts(p.map(x => ({ ...x, image: x.cover_url || x.image })))
      if (e)  setEpisodes(e)
      if (t)  setTracks(t)
      if (pl) setPlaylists(pl)
    } catch (err) {
      console.error('[Library] loadPublicLibrary exception:', err)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    loadPublicLibrary()
  }, [loadPublicLibrary])

  const value = {
    loading, podcasts, episodes, tracks, playlists,
    history, progress, loadPublicLibrary,
    setPodcasts, setEpisodes, setTracks, setPlaylists,
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export const useLibrary = () => {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}
