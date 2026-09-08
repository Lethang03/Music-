import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Compass, Radio, Library, Heart, Sun, Coffee, Zap, Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLibrary } from '../../contexts/LibraryContext'

export default function Sidebar() {
  const { profile, isAdmin } = useAuth()
  const { playlists } = useLibrary()

  return (
    <aside className="v2-sidebar">
      <div className="v2-sidebar-header">
        <div className="v2-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L12 22M6 8L6 16M18 8L18 16M3 12L4 12M20 12L21 12" stroke="url(#paint0_linear)" strokeWidth="3" strokeLinecap="round"/>
            <defs>
              <linearGradient id="paint0_linear" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF33A6"/>
                <stop offset="0.5" stopColor="#B833FF"/>
                <stop offset="1" stopColor="#4433FF"/>
              </linearGradient>
            </defs>
          </svg>
          SoundVerse
        </div>
      </div>

      <nav className="v2-sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}>
          <Home className="v2-nav-icon" size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/music" className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}>
          <Compass className="v2-nav-icon" size={20} />
          <span>Music</span>
        </NavLink>
        <NavLink to="/podcasts" className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}>
          <Radio className="v2-nav-icon" size={20} />
          <span>Podcasts</span>
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => `v2-nav-item ${isActive ? 'active' : ''}`}>
          <Library className="v2-nav-icon" size={20} />
          <span>Library</span>
        </NavLink>
      </nav>

      <div className="v2-sidebar-divider"></div>

      <div className="v2-sidebar-playlists">
        <div className="v2-playlist-header">PLAYLISTS</div>
        {playlists?.map(pl => (
          <NavLink key={pl.id} to={`/library?playlist=${pl.id}`} className="v2-nav-item secondary">
            <Library size={18} />
            <span>{pl.name}</span>
          </NavLink>
        ))}
        {(!playlists || playlists.length === 0) && (
          <div className="v2-nav-item secondary" style={{ opacity: 0.5 }}>
            <span>No playlists yet</span>
          </div>
        )}
      </div>

      <div className="v2-sidebar-footer">
        {isAdmin && (
          <NavLink to="/admin" className="v2-nav-item secondary" style={{ marginBottom: '8px' }}>
            <span>Admin Dashboard</span>
          </NavLink>
        )}
        <NavLink to="/profile" className="v2-user-footer">
          <div className="v2-user-avatar-sm">
             {profile?.display_name ? profile.display_name.charAt(0) : 'U'}
          </div>
          <div className="v2-user-meta">
            <strong>{profile?.display_name || 'Listener'}</strong>
            <small>Listener</small>
          </div>
        </NavLink>
      </div>

      <style>{`
        .v2-sidebar {
          width: var(--sidebar-width);
          background: rgba(11, 11, 19, 0.4);
          border-right: 1px solid rgba(255,255,255,0.03);
          display: flex;
          flex-direction: column;
          padding: var(--space-5);
          height: 100%;
          position: relative;
        }
        
        .v2-sidebar-header {
          margin-bottom: var(--space-6);
          padding: 0 var(--space-2);
        }
        .v2-logo {
          font-size: 1.25rem; font-weight: 800;
          display: flex; align-items: center; gap: 10px;
          letter-spacing: -0.02em; color: var(--text-primary);
        }

        .v2-sidebar-nav { display: flex; flex-direction: column; gap: var(--space-1); }
        
        .v2-nav-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: 12px 16px; border-radius: var(--radius-md);
          color: var(--text-secondary); text-decoration: none;
          font-weight: 600; transition: all var(--transition-fast);
          cursor: pointer; position: relative; overflow: hidden;
        }
        .v2-nav-item::before {
          content: ''; position: absolute; inset: 0;
          background: var(--accent-gradient); opacity: 0;
          transition: opacity var(--transition-normal); z-index: -1;
        }
        .v2-nav-item:hover { color: var(--text-primary); transform: translateX(4px); }
        .v2-nav-item:hover::before { opacity: 0.05; }
        .v2-nav-icon { opacity: 0.8; transition: all var(--transition-fast); }
        
        .v2-nav-item.active {
          color: var(--text-primary);
        }
        .v2-nav-item.active::before {
          opacity: 0.15;
        }
        .v2-nav-item.active .v2-nav-icon {
          color: var(--accent-primary); opacity: 1;
          filter: drop-shadow(0 0 6px var(--accent-glow));
        }
        
        .v2-sidebar-divider {
          height: 1px; background: rgba(255,255,255,0.05);
          margin: var(--space-5) 0;
        }

        .v2-sidebar-playlists { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .v2-playlist-header {
          font-size: 0.6875rem; font-weight: 700; color: var(--text-tertiary);
          letter-spacing: 0.1em; padding: 0 16px; margin-bottom: 8px;
        }
        
        .v2-nav-item.secondary { padding: 10px 16px; font-weight: 500; font-size: 0.875rem; gap: 12px; }
        .v2-nav-item.secondary:hover { color: var(--text-primary); transform: translateX(2px); }
        .v2-nav-item.secondary.action { color: var(--text-tertiary); }
        .v2-nav-item.secondary.action:hover { color: var(--text-primary); }

        .v2-sidebar-footer { padding-top: var(--space-4); border-top: 1px solid rgba(255,255,255,0.05); }
        .v2-user-footer {
          display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: var(--radius-md);
          text-decoration: none; transition: all var(--transition-fast);
        }
        .v2-user-footer:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); }
        .v2-user-avatar-sm {
          width: 32px; height: 32px; border-radius: 50%;
          background: var(--text-secondary); color: var(--bg-base);
          display: grid; place-items: center; font-weight: 700; font-size: 0.875rem;
        }
        .v2-user-meta { display: flex; flex-direction: column; }
        .v2-user-meta strong { color: var(--text-primary); font-size: 0.875rem; font-weight: 600; }
        .v2-user-meta small { color: var(--text-tertiary); font-size: 0.75rem; }

        @media (max-width: 768px) {
          .v2-sidebar { display: none; }
        }
      `}</style>
    </aside>
  )
}
