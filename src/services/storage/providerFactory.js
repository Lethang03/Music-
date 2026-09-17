import { createSupabaseStorageProvider } from './supabaseStorageProvider.js'

export function createStorageProvider(client, selected = 'supabase') {
  const providers = { supabase: createSupabaseStorageProvider(client) }
  return providers[selected] || providers.supabase
}
