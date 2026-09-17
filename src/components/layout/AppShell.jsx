import React from 'react'
import './Layout.css'
import { useLibrary } from '../../contexts/LibraryContext'
import { useAuth } from '../../contexts/AuthContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalPlayer from '../player/GlobalPlayer'
import BottomNav from './BottomNav'

export default function AppShell({ children }) {
  const { error, syncError, loadPublicLibrary, syncActivity } = useLibrary()
  const { error: authError } = useAuth()
  return (
    <div className="v2-app-shell">
      {/* Ambient background blobs — purely decorative */}
      <div className="v2-ambient-bg" aria-hidden="true">
        <div className="v2-ambient-blob v2-blob-1"></div>
        <div className="v2-ambient-blob v2-blob-2"></div>
      </div>

      {/* Sidebar — fixed left column on desktop */}
      <Sidebar />

      {/* Main column: topbar + scrollable content */}
      <div className="v2-main-wrapper">
        <Topbar />
        <main className="v2-main-content">
          <div className="v2-page-container">
            {authError && <div role="alert" className="v2-status-banner">{authError}</div>}
            {error && <div role="alert" className="v2-status-banner">Unable to load part of your library: {error} <button onClick={loadPublicLibrary}>Retry</button></div>}
            {syncError && <div role="status" className="v2-status-banner">{syncError} <button onClick={syncActivity}>Retry sync</button></div>}
            {children}
          </div>
        </main>
      </div>

      {/* Global Player — fixed bottom bar */}
      <GlobalPlayer />

      {/* Mobile bottom nav — shown only on mobile */}
      <BottomNav />
    </div>
  )
}
