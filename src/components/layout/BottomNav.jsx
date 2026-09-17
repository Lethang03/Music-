import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, Compass, Radio, Library, User } from 'lucide-react'

export default function BottomNav() {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/music', label: 'Music', icon: Compass },
    { path: '/podcasts', label: 'Podcasts', icon: Radio },
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
    </nav>
  )
}
