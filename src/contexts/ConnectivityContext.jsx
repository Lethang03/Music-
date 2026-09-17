import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

const ConnectivityContext = createContext()
export const useConnectivity = () => useContext(ConnectivityContext)

export function ConnectivityProvider({ children }) {
  const [offline, setOffline] = useState(() => navigator.onLine === false)
  const wasOffline = useRef(offline)
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const check = useCallback((retry = false) => {
    const next = navigator.onLine === false
    if (!next && (wasOffline.current || retry)) setRecoveryAttempt(n => n + 1)
    wasOffline.current = next
    setOffline(next)
  }, [])
  useEffect(() => {
    const update = () => check()
    const visible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', visible)
    check()
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('pageshow', update)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [check])
  return <ConnectivityContext.Provider value={{ recoveryAttempt }}>
    {children}
    {offline && <section role="dialog" aria-modal="true" aria-label="You're offline" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0b0b13', color: '#fff', display: 'grid', placeContent: 'center', padding: 32 }}>
      <h1>You're offline</h1>
      <p>Reconnect to load your music and podcasts.</p>
      <button className="v2-btn-primary" onClick={() => check(true)}>Try again</button>
    </section>}
  </ConnectivityContext.Provider>
}
