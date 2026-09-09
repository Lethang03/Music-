import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminOverview() {
  const [stats, setStats] = useState({
    tracks: 0, podcasts: 0, episodes: 0, users: 0,
    recentTracks: [], recentPodcasts: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadStats = async () => {
      try {
        const [
          tCount, pCount, eCount, uCount,
          rTracks, rPods
        ] = await Promise.all([
          supabase.from('music_tracks').select('id', { count: 'exact', head: true }),
          supabase.from('podcasts').select('id', { count: 'exact', head: true }),
          supabase.from('episodes').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('music_tracks').select('id, title, artist, cover_url, created_at, published').order('created_at', { ascending: false }).limit(5),
          supabase.from('podcasts').select('id, title, author, cover_url, created_at, published').order('created_at', { ascending: false }).limit(5)
        ])

        for (const result of [tCount, pCount, eCount, uCount, rTracks, rPods]) {
          if (result.error) throw result.error
        }

        if (cancelled) return

        setStats({
          tracks: tCount.count || 0,
          podcasts: pCount.count || 0,
          episodes: eCount.count || 0,
          users: uCount.count || 0,
          recentTracks: rTracks.data || [],
          recentPodcasts: rPods.data || []
        })
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadStats()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="v2-admin-loading">Loading overview...</div>
  if (error) return <div className="v2-status-banner" role="alert">{error}</div>

  return (
    <div className="v2-admin-overview">
      <div className="v2-admin-stats-grid">
        <div className="v2-admin-stat-card">
          <span>Total Tracks</span>
          <strong>{stats.tracks}</strong>
        </div>
        <div className="v2-admin-stat-card">
          <span>Total Podcasts</span>
          <strong>{stats.podcasts}</strong>
        </div>
        <div className="v2-admin-stat-card">
          <span>Total Episodes</span>
          <strong>{stats.episodes}</strong>
        </div>
        <div className="v2-admin-stat-card">
          <span>Total Users</span>
          <strong>{stats.users}</strong>
        </div>
      </div>

      <div className="v2-admin-recent-grid">
        <section className="v2-admin-section">
          <h2>Recently Added Music</h2>
          <div className="v2-admin-list">
            {stats.recentTracks.length === 0 && <p className="v2-admin-empty">No music yet.</p>}
            {stats.recentTracks.map(t => (
              <div key={t.id} className="v2-admin-list-item">
                <img src={t.cover_url || ''} alt="" className="v2-admin-thumb" />
                <div className="v2-admin-item-info">
                  <strong>{t.title}</strong>
                  <small>{t.artist}</small>
                </div>
                <div className="v2-admin-item-meta">
                  <span className={`v2-badge ${t.published ? 'success' : 'neutral'}`}>{t.published ? 'Published' : 'Draft'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="v2-admin-section">
          <h2>Recently Added Podcasts</h2>
          <div className="v2-admin-list">
            {stats.recentPodcasts.length === 0 && <p className="v2-admin-empty">No podcasts yet.</p>}
            {stats.recentPodcasts.map(p => (
              <div key={p.id} className="v2-admin-list-item">
                <img src={p.cover_url || ''} alt="" className="v2-admin-thumb" />
                <div className="v2-admin-item-info">
                  <strong>{p.title}</strong>
                  <small>{p.author}</small>
                </div>
                <div className="v2-admin-item-meta">
                  <span className={`v2-badge ${p.published ? 'success' : 'neutral'}`}>{p.published ? 'Published' : 'Draft'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
