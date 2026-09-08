import React, { useState, useRef, useCallback } from 'react'
import { supabase, supabaseReady } from '../../lib/supabase'
import { useDialog } from '../../lib/useDialog'
import { useAuth } from '../../contexts/AuthContext'

export default function AuthModal({ onClose, mode = 'login' }) {
  const dialogRef = useRef(null)
  const close = useCallback(() => onClose?.(), [onClose])
  useDialog(dialogRef, close)
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!supabaseReady) throw new Error('Sign in is unavailable until the connection is configured.')
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name } }
        })
        if (signUpError) throw signUpError
        if (!data.session) { setMessage('Check your email to confirm your account, then log in.'); return }
      }
      if (onClose) onClose()
    } catch (err) {
      setError(err.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="v2-auth-backdrop">
      <div ref={dialogRef} className="v2-auth-panel v2-glass" role="dialog" aria-modal="true" aria-label={isLogin ? 'Log in' : 'Sign up'}>
        {onClose && <button aria-label="Close" className="v2-modal-close" onClick={onClose}>✕</button>}
        
        <div className="v2-auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p>{isLogin ? 'Log in to continue listening.' : 'Join the premium streaming experience.'}</p>
        </div>

        {message && <div role="status">{message}</div>}
        {error && <div className="v2-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="v2-auth-form">
          {!isLogin && (
            <div className="v2-input-group">
              <label className="v2-label">Display Name</label>
              <input type="text" className="v2-input" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="v2-input-group">
            <label className="v2-label">Email Address</label>
            <input type="email" className="v2-input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="v2-input-group">
            <label className="v2-label">Password</label>
            <input type="password" className="v2-input" value={password} onChange={e => setPassword(e.target.value)} required minLength="6" />
          </div>

          <button type="submit" className="v2-btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div className="v2-auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError('') }}>
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>

      <style>{`
        .v2-auth-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000; display: grid; place-items: center; padding: 20px; }
        .v2-auth-panel { position: relative; width: 100%; max-width: 440px; padding: 48px 40px; border-radius: var(--radius-xl); background: var(--bg-panel); box-shadow: var(--shadow-lg); }
        .v2-modal-close { position: absolute; top: 24px; right: 24px; width: 32px; height: 32px; border-radius: 50%; background: var(--bg-panel-elevated); display: grid; place-items: center; cursor: pointer; }
        .v2-auth-header { text-align: center; margin-bottom: 32px; }
        .v2-auth-header h2 { font-size: 2rem; margin-bottom: 8px; }
        .v2-auth-header p { color: var(--text-secondary); }
        .v2-alert-error { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 24px; }
        .v2-auth-switch { text-align: center; margin-top: 24px; color: var(--text-secondary); font-size: 0.875rem; }
        .v2-auth-switch button { color: var(--accent-primary); font-weight: 700; cursor: pointer; }
      `}</style>
    </div>
  )
}

