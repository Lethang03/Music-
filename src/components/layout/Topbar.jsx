import React from 'react'
import { Bell, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Topbar() {
  const { profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <header className="v2-topbar">
      <div className="v2-topbar-glass"></div>
      
      <div className="v2-topbar-content">
        <div className="v2-topbar-left">
           <div className="v2-nav-arrows">
             <button className="v2-arrow-btn" onClick={() => navigate(-1)}><ChevronLeft size={20}/></button>
             <button className="v2-arrow-btn" onClick={() => navigate(1)}><ChevronRight size={20}/></button>
           </div>
        </div>
        
        <div className="v2-topbar-center">
          <div className="v2-search-input-wrapper">
             <Search size={18} className="v2-search-icon" />
             <input type="text" placeholder="Tìm kiếm bài hát, nghệ sĩ, podcast..." className="v2-global-search" onClick={() => {
                if (location.pathname !== '/search') navigate('/search')
             }}/>
          </div>
        </div>

        <div className="v2-topbar-right">
          <button className="v2-icon-btn v2-bell-btn">
            <Bell size={18} />
            <span className="v2-notification-dot"></span>
          </button>
          <Link to="/profile" className="v2-user-pill">
            <img src="https://i.pravatar.cc/150?img=47" alt="Profile" className="v2-user-avatar-img" />
          </Link>
        </div>
      </div>

      <style>{`
        .v2-topbar {
          height: var(--topbar-height);
          position: sticky;
          top: 0;
          z-index: 55;
        }
        .v2-topbar-glass {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(11, 11, 19, 0.9) 0%, rgba(11, 11, 19, 0) 100%);
          pointer-events: none;
        }
        .v2-topbar-content {
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
        }

        .v2-topbar-left { flex: 1; }
        .v2-nav-arrows { display: flex; gap: 8px; }
        .v2-arrow-btn {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.03); border: none; color: var(--text-secondary);
          display: grid; place-items: center; cursor: pointer; transition: all var(--transition-fast);
        }
        .v2-arrow-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

        .v2-topbar-center {
          flex: 2; display: flex; justify-content: center;
        }
        .v2-search-input-wrapper {
          position: relative;
          width: 100%; max-width: 480px;
        }
        .v2-global-search {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.02);
          border-radius: var(--radius-full);
          padding: 10px 16px 10px 48px;
          color: var(--text-primary);
          font-size: 0.9375rem;
          outline: none;
          transition: all var(--transition-fast);
        }
        .v2-global-search::placeholder { color: var(--text-tertiary); }
        .v2-global-search:focus { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.1); }
        .v2-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); pointer-events: none; }

        .v2-topbar-right {
          flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: var(--space-4);
        }
        
        .v2-bell-btn { position: relative; color: var(--text-secondary); }
        .v2-bell-btn:hover { color: var(--text-primary); }
        .v2-notification-dot {
          position: absolute; top: 4px; right: 4px;
          width: 8px; height: 8px; background: var(--accent-secondary);
          border-radius: 50%; border: 2px solid var(--bg-base);
        }

        .v2-user-avatar-img {
          width: 32px; height: 32px; border-radius: 50%; object-fit: cover;
          border: 2px solid transparent; transition: border 0.2s;
        }
        .v2-user-pill:hover .v2-user-avatar-img { border-color: rgba(255,255,255,0.2); }

        @media (max-width: 768px) {
          .v2-topbar-content { padding: 0 var(--space-4); }
          .v2-topbar-left { display: none; }
          .v2-topbar-center { flex: 1; justify-content: flex-start; }
          .v2-global-search { padding-left: 40px; }
          .v2-search-icon { left: 12px; }
        }
      `}</style>
    </header>
  )
}
