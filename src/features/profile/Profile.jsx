import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, Settings, Clock, Heart, Radio, Edit2, Check, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Profile() {
  const { profile, session, signOut, fetchProfile } = useAuth()
  const navigate = useNavigate()
  
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSave = async () => {
    if (!session?.user?.id) return
    setSaving(true)
    setError('')
    setSuccess('')
    
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', session.user.id)

      if (updateError) throw updateError
      
      await fetchProfile() // Refresh from context
      setSuccess('Profile updated successfully')
      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="v2-page v2-animate-fade">
      <header className="v2-profile-header">
        <div className="v2-profile-avatar">
          {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="v2-profile-info">
          <div className="v2-profile-type">PREMIUM MEMBER</div>
          
          {isEditing ? (
            <div className="v2-profile-edit-form">
              <input 
                type="text" 
                className="v2-input" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display Name"
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="v2-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 size={16} className="v2-spin" /> : <Check size={16} />} Save
                </button>
                <button className="v2-btn-secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                  <X size={16} /> Cancel
                </button>
              </div>
              {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: 4 }}>{error}</p>}
            </div>
          ) : (
            <>
              <h1>{profile?.display_name || 'User'}</h1>
              <p>{profile?.email || 'email@example.com'}</p>
            </>
          )}
        </div>
      </header>

      {!isEditing && (
        <div className="v2-profile-actions">
          <button className="v2-btn-primary" onClick={() => setIsEditing(true)}>
            <Edit2 size={16} /> Edit Profile
          </button>
          <button className="v2-btn-secondary" onClick={() => navigate('/settings')}>
            <Settings size={16} /> Account Settings
          </button>
        </div>
      )}
      
      {success && (
        <div className="v2-alert-success">
          <Check size={16} /> {success}
        </div>
      )}

      {/* Note: Stats are hidden until backend tables exist */}
      <section className="v2-section">
        <h2>Listening Stats</h2>
        <div className="v2-stats-grid">
          <div className="v2-stat-card v2-disabled-feature">
            <div className="v2-stat-icon"><Clock size={24} /></div>
            <div className="v2-stat-content">
              <small>Total Listening Time</small>
              <strong>—</strong>
              <span className="v2-coming-soon">Coming Soon</span>
            </div>
          </div>
          <div className="v2-stat-card v2-disabled-feature">
            <div className="v2-stat-icon"><Heart size={24} /></div>
            <div className="v2-stat-content">
              <small>Liked Songs</small>
              <strong>—</strong>
              <span className="v2-coming-soon">Coming Soon</span>
            </div>
          </div>
          <div className="v2-stat-card v2-disabled-feature">
            <div className="v2-stat-icon"><Radio size={24} /></div>
            <div className="v2-stat-content">
              <small>Podcasts Followed</small>
              <strong>—</strong>
              <span className="v2-coming-soon">Coming Soon</span>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .v2-page { display: flex; flex-direction: column; gap: 48px; max-width: 1000px; }
        .v2-profile-header {
          display: flex; align-items: flex-end; gap: 32px;
        }
        .v2-profile-avatar {
          width: 192px; height: 192px; border-radius: 50%;
          background: var(--accent-gradient); color: white;
          display: grid; place-items: center; font-size: 72px; font-weight: 800;
          box-shadow: 0 16px 40px var(--accent-glow); flex-shrink: 0;
        }
        .v2-profile-type { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; color: var(--text-secondary); margin-bottom: 8px; }
        .v2-profile-info { flex: 1; }
        .v2-profile-info h1 { font-size: 4rem; margin-bottom: 8px; line-height: 1.1; letter-spacing: -0.04em; }
        .v2-profile-info p { color: var(--text-secondary); font-size: 1.125rem; }
        
        .v2-profile-edit-form { display: flex; flex-direction: column; gap: 8px; max-width: 400px; }
        .v2-profile-edit-form input { padding: 12px 16px; font-size: 1.25rem; }

        .v2-profile-actions { display: flex; gap: 16px; margin-top: -16px; }

        .v2-section h2 { font-size: 1.5rem; margin-bottom: 24px; font-weight: 800; }
        .v2-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
        .v2-stat-card {
          background: var(--bg-panel-elevated); border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg); padding: 24px;
          display: flex; align-items: center; gap: 20px;
          transition: transform var(--transition-fast);
        }
        .v2-stat-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(155, 108, 255, 0.1); color: var(--accent-primary); display: grid; place-items: center; }
        .v2-stat-content { display: flex; flex-direction: column; gap: 4px; position: relative; }
        .v2-stat-content small { color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; font-size: 0.75rem; }
        .v2-stat-content strong { font-size: 1.75rem; color: var(--text-primary); }

        .v2-disabled-feature { opacity: 0.5; filter: grayscale(0.8); cursor: not-allowed; }
        .v2-disabled-feature:hover { transform: none; }
        .v2-coming-soon {
          font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
          background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;
          color: var(--text-secondary); width: max-content; margin-top: 4px;
        }

        .v2-alert-success {
          background: rgba(34, 197, 94, 0.1); color: #4ade80;
          padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px;
          border: 1px solid rgba(34, 197, 94, 0.2); font-weight: 600; font-size: 0.875rem;
        }

        .v2-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .v2-profile-header { flex-direction: column; text-align: center; align-items: center; gap: 24px; }
          .v2-profile-avatar { width: 140px; height: 140px; font-size: 56px; }
          .v2-profile-info h1 { font-size: 2.5rem; }
          .v2-profile-actions { justify-content: center; }
        }
      `}</style>
    </div>
  )
}
