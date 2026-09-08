import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LibraryProvider, useLibrary } from './contexts/LibraryContext'
import { AudioProvider } from './contexts/AudioContext'
import AppShell from './components/layout/AppShell'
import AuthModal from './features/auth/AuthModal'
import LandingPage from './features/landing/LandingPage'
const HomePage = lazy(() => import('./features/home/HomePage'))
const MusicLibrary = lazy(() => import('./features/music/MusicLibrary'))
const PodcastBrowse = lazy(() => import('./features/podcast/PodcastBrowse'))
const PodcastDetail = lazy(() => import('./features/podcast/PodcastDetail'))
const Profile = lazy(() => import('./features/profile/Profile'))
const SearchPage = lazy(() => import('./features/search/SearchPage'))
const LibraryPage = lazy(() => import('./features/library/LibraryPage'))
const AdminPage = lazy(() => import('./features/admin/AdminPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

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
function AdminRoute() {
  const { isAdmin } = useAuth()
  return isAdmin ? <AdminPage /> : <div className="v2-page"><div className="v2-status-banner" role="alert">You do not have access to the Admin Dashboard.</div></div>
}
function AudioBridge({ children }) {
  const { session } = useAuth()
  const { recordProgress, getResumeTime } = useLibrary()
  return <AudioProvider storageKey={`soundverse_player:${session.user.id}`} onProgress={recordProgress} getResumeTime={getResumeTime}>{children}</AudioProvider>
}
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
      <Route path="/admin"   element={<AdminRoute />} />
      {/* Catch-all — redirect to home */}
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

// ── Root content — renders landing or authenticated shell ───────────────────
function AppContent() {
  const { session, loading, error } = useAuth()
  const [showAuth, setShowAuth] = React.useState(false)
  const [authMode, setAuthMode] = React.useState('login')

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
        {error && <div className="v2-status-banner" role="alert">{error}</div>}
        <LandingPage onShowAuth={mode => { setAuthMode(mode === 'register' ? 'register' : 'login'); setShowAuth(true) }} />
        {showAuth && <AuthModal mode={authMode} onClose={() => setShowAuth(false)} />}
      </>
    )
  }

  return (
    <LibraryProvider key={session.user.id}><AudioBridge><AppShell><Suspense fallback={<div className="v2-page-loading">Loading page…</div>}><AppRoutes /></Suspense></AppShell></AudioBridge></LibraryProvider>
  )
}

// ── App root with all providers ─────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  )
}
