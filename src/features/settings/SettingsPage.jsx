import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAudio } from '../../contexts/AudioContext'
import { readStored, writeStored } from '../../lib/storage'
export default function SettingsPage() {
  const { signOut, session, isAdmin } = useAuth()
  const { volume, setVolume, shuffle, setShuffle, repeat, setRepeat, autoplay, setAutoplay } = useAudio()
  const [theme, setTheme] = useState(() => readStored('soundverse_theme', 'dark'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="v2-page"><h1>Settings</h1><p>Playback and appearance preferences are saved on this browser.</p>
    <section className="v2-settings-section"><h2>Audio and playback</h2>
      <label className="v2-setting-item">Volume <input aria-label="Default volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /><span>{Math.round(volume * 100)}%</span></label>
      <label className="v2-setting-item">Shuffle <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} /></label>
      <label className="v2-setting-item">Repeat <select aria-label="Repeat" value={repeat} onChange={e => setRepeat(e.target.value)}><option value="none">Off</option><option value="one">One</option><option value="all">All</option></select></label>
      <label className="v2-setting-item">Automatically play next <input type="checkbox" checked={autoplay} onChange={e => setAutoplay(e.target.checked)} /></label>
    </section>
    <section className="v2-settings-section"><h2>Appearance</h2><label className="v2-setting-item">Theme <select aria-label="Theme" value={theme} onChange={e => { setTheme(e.target.value); writeStored('soundverse_theme', e.target.value); document.documentElement.dataset.theme = e.target.value }}><option value="dark">Dark</option><option value="light">Light</option></select></label></section>
    <section className="v2-settings-section"><h2>Account</h2><p>{session.user.email}</p>
      {isAdmin && <Link to="/admin" className="v2-btn-secondary" style={{ width: 'fit-content' }}>Admin Dashboard</Link>}
      {error && <p role="alert">{error}</p>}
      <button className="v2-btn-secondary" style={{ width: 'fit-content' }} disabled={busy} onClick={async () => { setBusy(true); try { await signOut() } catch (err) { setError(err.message); setBusy(false) } }}>Log out</button>
    </section>
  </div>
}
