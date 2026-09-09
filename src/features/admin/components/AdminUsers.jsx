import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('id, display_name, username, avatar_url, role, created_at').order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleToggleRole = async (user) => {
    if (!window.confirm(`Change ${user.display_name || user.username || 'this user'}'s role to ${user.role === 'admin' ? 'user' : 'admin'}?`)) return
    setBusy(true)
    setError('')
    try {
      const newRole = user.role === 'admin' ? 'user' : 'admin'
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
      if (error) throw error
      await loadUsers()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const filtered = users.filter(u => 
    u.display_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.username?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="v2-admin-section-page">
      <div className="v2-admin-toolbar">
        <input 
          type="search" 
          placeholder="Search users..." 
          className="v2-admin-search" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {error && <div className="v2-status-banner error" role="alert">{error}</div>}

      {loading ? (
        <div className="v2-admin-loading">Loading users...</div>
      ) : (
        <div className="v2-admin-table-wrapper">
          <table className="v2-admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Joined</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="v2-admin-cell-flex">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="v2-admin-avatar-sm" />
                      ) : (
                        <div className="v2-admin-avatar-placeholder">{(u.display_name || 'U')[0]}</div>
                      )}
                      <div>
                        <strong>{u.display_name || 'Anonymous'}</strong>
                        <small>{u.username ? `@${u.username}` : u.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`v2-badge ${u.role === 'admin' ? 'admin' : 'neutral'}`}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td>
                    <div className="v2-admin-actions">
                      <button onClick={() => handleToggleRole(u)} disabled={busy} className="v2-admin-btn-text">
                        {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="v2-admin-empty">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

