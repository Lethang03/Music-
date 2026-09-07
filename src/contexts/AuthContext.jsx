import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase, supabaseReady } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If Supabase is not configured, immediately stop loading
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) console.error('[Auth] getSession error:', error.message)
      setSession(data?.session ?? null)
      // If no session, we can stop loading immediately
      if (!data?.session) {
        setLoading(false)
      }
      // If there IS a session, loading will be set false after profile fetch
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Fetch profile when session changes
  useEffect(() => {
    if (!supabaseReady || !session?.user) {
      // No session means loading already set to false above
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(() => {
      // Safety timeout — never leave app in loading state
      if (!cancelled) {
        console.warn('[Auth] Profile fetch timed out, proceeding without profile')
        setLoading(false)
      }
    }, 5000)

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        if (error) {
          console.error('[Auth] Profile fetch error:', error.message)
        } else if (data) {
          setProfile(data)
        } else {
          // Profile row doesn't exist yet — create a minimal one
          setProfile({ id: session.user.id, email: session.user.email, display_name: session.user.email?.split('@')[0] })
        }
      } catch (err) {
        if (!cancelled) console.error('[Auth] Profile fetch exception:', err)
      } finally {
        clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      }
    }

    fetchProfile()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [session])

  const signOut = async () => {
    if (supabaseReady) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('[Auth] Sign out error:', err)
      }
    }
    setSession(null)
    setProfile(null)
  }

  const value = { session, profile, loading, signOut, setProfile }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
