import React from 'react'
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

      <style>{`
        /* ── Root shell ── */
        .v2-app-shell {
          display: flex;
          height: 100dvh;
          overflow: hidden;
          background: var(--bg-base);
          position: relative;
        }

        /* ── Ambient background ── */
        .v2-ambient-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
          pointer-events: none;
        }
        .v2-ambient-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.08;
          animation: v2-blob-float 25s infinite alternate ease-in-out;
        }
        .v2-blob-1 {
          top: -20%; left: -10%;
          width: 60vw; height: 60vw;
          background: var(--accent-primary);
        }
        .v2-blob-2 {
          bottom: -10%; right: -20%;
          width: 50vw; height: 50vw;
          background: var(--accent-secondary);
          animation-delay: -12s;
        }
        @keyframes v2-blob-float {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(10%, 15%) scale(1.1); }
        }

        /* ── Main wrapper ── */
        .v2-main-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          /* Full height minus global player at the bottom */
          height: 100%;
          overflow: hidden;
          position: relative;
          z-index: 10;
        }

        /* ── Scrollable main content ── */
        .v2-main-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          /* Leave room for the fixed global player */
          padding-bottom: var(--player-height);
          /* Custom scrollbar */
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .v2-main-content::-webkit-scrollbar {
          width: 6px;
        }
        .v2-main-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .v2-main-content::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        /* ── Page content container ── */
        .v2-page-container {
          padding: 32px 48px 48px;
          max-width: 1800px;
          margin: 0 auto;
          width: 100%;
        }

        /* ── Shared animation ── */
        .v2-animate-fade {
          animation: v2-fade-in 0.3s ease-out both;
        }
        @keyframes v2-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .v2-page-loading {
          min-height: 50vh;
          display: grid;
          place-items: center;
          color: var(--text-secondary);
          font-size: 1rem;
          font-weight: 600;
          gap: 16px;
          flex-direction: column;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .v2-app-shell {
            flex-direction: column;
          }
          .v2-main-wrapper {
            height: 100dvh;
          }
          .v2-main-content {
            /* On mobile, leave room for both player mini and bottom nav */
            padding-bottom: calc(var(--player-height) + var(--mobile-nav-height));
          }
          .v2-page-container {
            padding: 20px 16px 32px;
          }
        }
      `}</style>
    </div>
  )
}
