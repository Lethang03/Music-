import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { readStored } from './lib/storage'
document.documentElement.dataset.theme = readStored('soundverse_theme', 'dark')
import './styles/variables.css'
import './styles/main.css'
const isTestOrDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'test' || /Playwright/i.test(navigator.userAgent)

async function prepareServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const staleRegistrations = registrations.filter(registration =>
      isTestOrDevelopment || !registration.active?.scriptURL.endsWith('/sw.js')
    )
    const hadStaleController = staleRegistrations.some(registration => registration.active?.scriptURL === navigator.serviceWorker.controller?.scriptURL)

    await Promise.all(staleRegistrations.map(registration => registration.unregister()))

    // unregister() only affects subsequent navigations. Reload once before lazy routes
    // are requested so a legacy worker cannot intercept their module fetches.
    if (hadStaleController && !sessionStorage.getItem('soundverse_sw_cleanup_complete')) {
      sessionStorage.setItem('soundverse_sw_cleanup_complete', '1')
      window.location.reload()
      return new Promise(() => {})
    }
  } catch (error) {
    console.warn('Service worker cleanup failed:', error)
  }

  if (import.meta.env.PROD && !isTestOrDevelopment) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Offline support unavailable:', error))
    }, { once: true })
  }
}

async function startApp() {
  await prepareServiceWorker()
  ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
  )
}

startApp()
