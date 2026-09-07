import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LibraryProvider } from './contexts/LibraryContext'
import { AudioProvider } from './contexts/AudioContext'
import AppShell from './components/layout/AppShell'
import AuthModal from './features/auth/AuthModal'
import LandingPage from './features/landing/LandingPage'
import HomePage from './features/home/HomePage'
import MusicLibrary from './features/music/MusicLibrary'
import PodcastBrowse from './features/podcast/PodcastBrowse'
import PodcastDetail from './features/podcast/PodcastDetail'
import Profile from './features/profile/Profile'
import SearchPage from './features/search/SearchPage'
import LibraryPage from './features/library/LibraryPage'
import AdminPage from './features/admin/AdminPage'
import SettingsPage from './features/settings/SettingsPage'

// ── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0B0B13', color: '#fff', gap: 16, padding: 32, textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 400 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              padding: '12px 28px', borderRadius: '9999px',
              background: 'linear-gradient(135deg,#FF33A6,#B833FF,#4433FF)',
              color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '1rem'
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Routes inside AppShell ──────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/"        element={<HomePage />} />
      <Route path="/search"  element={<SearchPage />} />
      <Route path="/music"   element={<MusicLibrary />} />
      <Route path="/podcasts"     element={<PodcastBrowse />} />
      <Route path="/podcasts/:id" element={<PodcastDetail />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/admin"   element={<AdminPage />} />
      {/* Catch-all — redirect to home */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

// ── Root content — renders landing or authenticated shell ───────────────────
function AppContent() {
  const { session, loading } = useAuth()
  const [showAuth, setShowAuth] = React.useState(false)

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0B0B13', flexDirection: 'column', gap: 20
      }}>
        {/* Minimal branded loader — never stuck more than 5s (see AuthContext timeout) */}
        <div style={{
          width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#D14FFF', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Loading SoundVerse…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <LandingPage onShowAuth={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    )
  }

  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  )
}

// ── App root with all providers ─────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LibraryProvider>
          <AudioProvider>
            <AppContent />
          </AudioProvider>
        </LibraryProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
