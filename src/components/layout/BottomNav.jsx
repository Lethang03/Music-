import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Library, User } from 'lucide-react'

export default function BottomNav() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/library', label: 'Library', icon: Library },
    { path: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="v2-bottom-nav">
      {navItems.map(item => {
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
        return (
          <Link key={item.path} to={item.path} className={`v2-bottom-nav-item ${isActive ? 'active' : ''}`}>
            <item.icon size={24} />
            <span>{item.label}</span>
          </Link>
        )
      })}

      <style>{`
        .v2-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: var(--mobile-nav-height);
          background: rgba(13, 13, 18, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid var(--border-strong);
          z-index: 60; /* Above global player (50) on mobile */
          padding-bottom: env(safe-area-inset-bottom);
        }
        .v2-bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: var(--text-secondary);
          font-size: 0.65rem;
          font-weight: 600;
          transition: color var(--transition-fast);
        }
        .v2-bottom-nav-item.active {
          color: var(--text-primary);
        }
        
        @media (max-width: 768px) {
          .v2-bottom-nav { display: flex; }
        }
      `}</style>
    </nav>
  )
}

