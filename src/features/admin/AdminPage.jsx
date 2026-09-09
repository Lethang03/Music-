import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AdminLayout from './components/AdminLayout'
import AdminOverview from './components/AdminOverview'
import AdminMusic from './components/AdminMusic'
import AdminMusicImport from './components/AdminMusicImport'
import AdminPodcasts from './components/AdminPodcasts'
import AdminPodcastImport from './components/AdminPodcastImport'
import AdminEpisodes from './components/AdminEpisodes'
import AdminUsers from './components/AdminUsers'
import './admin.css'

export default function AdminPage() {
  const { isAdmin } = useAuth()
  // Open the content workspace first; it is the admin's primary CRUD surface.
  const [activeTab, setActiveTab] = useState('music_tracks')

  if (!isAdmin) return <div className="v2-page"><p role="alert" className="v2-status-banner">Administrator access required.</p></div>

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <AdminOverview />
      case 'music_tracks': return <AdminMusic />
      case 'music_import': return <AdminMusicImport />
      case 'podcasts': return <AdminPodcasts />
      case 'podcast_import': return <AdminPodcastImport />
      case 'episodes': return <AdminEpisodes />
      case 'profiles': return <AdminUsers />
      default: return <AdminOverview />
    }
  }

  return (
    <div className="v2-page" style={{ padding: 0, overflow: 'hidden' }}>
      <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </AdminLayout>
    </div>
  )
}
