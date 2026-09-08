import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase, supabaseReady, configurationError } from '../lib/supabase'
const AuthContext = createContext()
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(configurationError)
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [profileLoading, setProfileLoading] = useState(false)
  const userRef = useRef(null)
  userRef.current = session?.user?.id
  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    let mounted = true
    let authEvent = false
    const timer = setTimeout(() => {
      if (mounted) { setError('Session loading timed out. Reload to retry.'); setLoading(false) }
    }, 10000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return
      authEvent = true
      if (userRef.current && userRef.current !== next?.user?.id) window.dispatchEvent(new Event('auth_cleared'))
      setSession(next)
      if (userRef.current !== next?.user?.id) setProfile(null)
      if (!next) { setProfile(null); setLoading(false) }
      clearTimeout(timer)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) setError(error.message)
      if (!authEvent) setSession(data?.session || null)
      if (!data?.session) setLoading(false)
      clearTimeout(timer)
    }).catch(err => {
      if (mounted) { setError(err.message); setLoading(false); clearTimeout(timer) }
    })
    return () => { mounted = false; clearTimeout(timer); subscription.unsubscribe() }
  }, [])
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setProfile(null); return }
    let cancelled = false
    setProfileLoading(true)
    const fallback = { id: userId, display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Listener' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const fetchProfile = async () => {
      let { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle().abortSignal(controller.signal)
      if (error) throw error
      if (!data && !cancelled) {
        // Ignore a concurrent trigger insert; never overwrite an existing profile.
        const created = await supabase.from('profiles').upsert(fallback, { onConflict: 'id', ignoreDuplicates: true }).abortSignal(controller.signal)
        if (created.error) throw created.error
        const fetched = await supabase.from('profiles').select('*').eq('id', userId).single().abortSignal(controller.signal)
        if (fetched.error) throw fetched.error
        data = fetched.data
      }
      if (!data) throw new Error('Profile was not created.')
      if (!cancelled) { setProfile(data); setError('') }
    }
    fetchProfile().catch(() => {
      if (!cancelled) { setProfile(fallback); setError('Your profile could not be loaded. Please retry from Profile.') }
    }).finally(() => { clearTimeout(timer); if (!cancelled) { setLoading(false); setProfileLoading(false) } })
    return () => { cancelled = true; controller.abort(); clearTimeout(timer) }
  }, [userId, profileAttempt])
  const signOut = async () => {
    // Attempt graceful audio pause before unmount
    const pending = []
    window.dispatchEvent(new CustomEvent('auth_signout', { detail: { pending } }))
    await Promise.allSettled(pending)
    
    const { error } = await supabase.auth.signOut()
    if (error) { setError(error.message); throw error }
    setSession(null); setProfile(null)
  }
  const saveProfile = async fields => {
    const id = userId
    if (!id) throw new Error('Please sign in again.')
    const editable = Object.fromEntries(Object.entries(fields).filter(([key]) => ['display_name', 'username', 'avatar_url', 'bio'].includes(key)))
    const { data, error } = await supabase.from('profiles').upsert({ ...editable, id }, { onConflict: 'id' }).select().single()
    if (error) throw error
    if (userRef.current === id) { setProfile(data); setError('') }
    return data
  }
  // Database authorization enforces the same logic via soundverse_is_admin()
  const isAdmin = session?.user?.app_metadata?.role === 'admin' || profile?.role === 'admin'
  return <AuthContext.Provider value={{ session, profile: profile?.id === userId ? profile : null, loading, profileLoading, retryProfile: () => setProfileAttempt(n => n + 1), error, signOut, setProfile, saveProfile, isAdmin }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
