import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLibrary } from '../../contexts/LibraryContext'
import { validUrl } from '../../lib/storage'
export default function Profile() {
  const { profile, session, saveProfile, error, retryProfile, profileLoading, isAdmin } = useAuth()
  const { history, favorites } = useLibrary()
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const days = new Set(history.flatMap(row => row.listening_days || []))
  let streak = 0
  const date = new Date()
  if (!days.has(date.toISOString().slice(0, 10))) date.setUTCDate(date.getUTCDate() - 1)
  while (days.has(date.toISOString().slice(0, 10))) { streak++; date.setUTCDate(date.getUTCDate() - 1) }
  const submit = async e => {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      if (!validUrl(form.avatar_url)) throw new Error('Use an HTTP or HTTPS avatar URL.')
      const fields = { display_name: form.display_name.trim(), avatar_url: form.avatar_url || null, bio: form.bio }
      if (form.username !== (profile?.username || '') || Object.hasOwn(profile || {}, 'username')) fields.username = form.username.trim() || null
      await saveProfile(fields)
      setForm(null); setMessage('Profile saved')
    } catch (err) { setMessage(err.message) } finally { setBusy(false) }
  }
  return <div className="v2-page">
    {error && <button className="v2-btn-secondary" disabled={profileLoading} onClick={retryProfile}>{profileLoading ? 'Loading profile…' : 'Retry profile'}</button>}
    <header className="v2-profile-heading"><div className="v2-profile-picture">{profile?.avatar_url ? <img src={profile.avatar_url} alt="Your avatar" /> : (profile?.display_name || 'L')[0]}</div><div><small>LISTENER</small><h1>{profile?.display_name || 'Listener'}</h1><p>{session.user.email}</p>{profile?.username && <p>@{profile.username}</p>}<p>{profile?.bio}</p></div></header>
    {message && <p role="status" className="v2-status-banner">{message}</p>}
    {form ? <form onSubmit={submit} className="v2-form-panel">
      <label>Display name<input required maxLength={120} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>Username<input pattern="[A-Za-z0-9_]{3,30}" title="3–30 letters, numbers or underscores" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
      <label>Avatar URL<input type="url" value={form.avatar_url} onChange={e => setForm({ ...form, avatar_url: e.target.value })} /></label>
      <label>About you<textarea maxLength={2000} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></label>
      <div className="v2-action-row"><button className="v2-btn-primary" disabled={busy || !form.display_name.trim()}>Save profile</button><button type="button" className="v2-btn-secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</button></div>
    </form> : <div className="v2-action-row"><button className="v2-btn-primary" onClick={() => setForm({ display_name: profile?.display_name || '', username: profile?.username || '', avatar_url: profile?.avatar_url || '', bio: profile?.bio || '' })}>Edit profile</button><Link className="v2-btn-secondary" to="/settings">Account settings</Link>{isAdmin && <Link className="v2-btn-secondary" to="/admin">Admin Dashboard</Link>}</div>}
    <section><h2>Listening statistics</h2><p>Based on recorded listening in SoundVerse. Listening days use UTC.</p><div className="v2-stats-grid">
      <div className="v2-stat-card"><strong>{Math.floor(history.reduce((sum, row) => sum + (row.listened_seconds || 0), 0) / 60)}</strong><span>Minutes listened</span></div>
      <div className="v2-stat-card"><strong>{favorites.length}</strong><span>Favorites</span></div>
      <div className="v2-stat-card"><strong>{streak}</strong><span>Day streak</span></div>
    </div></section>
  </div>
}
