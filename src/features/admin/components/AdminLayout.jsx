import React from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Music, Radio, ListMusic, Users, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../../contexts/AuthContext'

export default function AdminLayout({ children, activeTab, onTabChange }) {
  const { profile } = useAuth()

  const navs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'music_tracks', label: 'Music', icon: Music },
    { id: 'podcasts', label: 'Podcasts', icon: Radio },
    { id: 'episodes', label: 'Episodes', icon: ListMusic },
    { id: 'profiles', label: 'Users', icon: Users },
  ]

  return (
    <div className="v2-admin-layout">
      {/* Sidebar */}
      <aside className="v2-admin-sidebar">
        <div className="v2-admin-sidebar-header">
          <h2>SoundVerse Admin</h2>
        </div>
        <nav className="v2-admin-nav">
          {navs.map(n => {
            const Icon = n.icon
            return (
              <button 
                key={n.id} 
                className={`v2-admin-nav-item ${activeTab === n.id ? 'active' : ''}`}
                onClick={() => onTabChange(n.id)}
              >
                <Icon size={18} />
                <span>{n.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="v2-admin-sidebar-footer">
          <Link to="/" className="v2-admin-nav-item">
            <ArrowLeft size={18} />
            <span>Exit Admin</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="v2-admin-main">
        {/* Top Header */}
        <header className="v2-admin-header">
          <div className="v2-admin-header-title">
            <h1 style={{ textTransform: 'capitalize' }}>
              {navs.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="v2-admin-header-user">
            <span className="v2-admin-avatar">
               {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.display_name || 'A')[0]}
            </span>
            <div className="v2-admin-user-info">
              <strong>{profile?.display_name}</strong>
              <small>Administrator</small>
            </div>
          </div>
        </header>

        {/* Content Scrollable Area */}
        <div className="v2-admin-content-scroll">
          {children}
        </div>
      </div>

      {/* Mobile Nav (Bottom) */}
      <nav className="v2-admin-mobile-nav">
        {navs.map(n => {
          const Icon = n.icon
          return (
            <button 
              key={n.id} 
              className={`v2-admin-mobile-item ${activeTab === n.id ? 'active' : ''}`}
              onClick={() => onTabChange(n.id)}
            >
              <Icon size={20} />
              <small>{n.label}</small>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

