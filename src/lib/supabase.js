import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
let configurationError = ''
try {
  if (!url || !key || !['https:', 'http:'].includes(new URL(url).protocol)) throw new Error()
  if (key.startsWith('sb_secret_')) throw new Error()
  if (key.startsWith('eyJ')) {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role !== 'anon') throw new Error()
  }
} catch { configurationError = 'Connection is not configured. Set a valid Supabase URL and public publishable key.' }
export { configurationError }
export const supabaseReady = !configurationError
export const supabase = supabaseReady ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  db: { retry: false },
  global: { fetch: async (input, init = {}) => {
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (init.signal?.aborted) abort()
    init.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 15000)
    try { return await fetch(input, { ...init, signal: controller.signal }) }
    finally { clearTimeout(timer); init.signal?.removeEventListener('abort', abort) }
  } }
}) : null
