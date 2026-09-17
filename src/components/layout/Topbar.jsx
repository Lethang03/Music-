import React from 'react'
import { Settings, Search, ChevronLeft, ChevronRight } from 'lucide-react'
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
             <button aria-label="Back" className="v2-arrow-btn" onClick={() => navigate(-1)}><ChevronLeft size={20}/></button>
             <button aria-label="Forward" className="v2-arrow-btn" onClick={() => navigate(1)}><ChevronRight size={20}/></button>
           </div>
        </div>
        
        <div className="v2-topbar-center">
          <div className="v2-search-input-wrapper">
             <Search size={18} className="v2-search-icon" />
             <input type="text" placeholder="Search SoundVerse" className="v2-global-search" aria-label="Search library" value={new URLSearchParams(location.search).get('q') || ''} onChange={e => navigate(`/search?q=${encodeURIComponent(e.target.value)}`, { replace: location.pathname === '/search' })} onFocus={() => { if (location.pathname !== '/search') navigate('/search') }}/>
          </div>
        </div>

        <div className="v2-topbar-right">
          <Link to="/settings" className="v2-icon-btn" aria-label="Settings"><Settings size={20}/></Link>
          <Link to="/profile" className="v2-user-pill">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="v2-user-avatar-img" /> : <span aria-label="Profile" className="v2-user-avatar-sm">{(profile?.display_name || 'L')[0]}</span>}
          </Link>
        </div>
      </div>
    </header>
  )
}
