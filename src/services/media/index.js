import { createSupabaseMediaProvider } from './supabaseMediaProvider'

const selected = import.meta.env.VITE_MEDIA_PROVIDER || 'supabase'
// Register an R2 provider here when migration is ready. Unknown values retain
// the current provider so a configuration typo cannot interrupt playback.
const providers = {
  supabase: createSupabaseMediaProvider(import.meta.env.VITE_SUPABASE_URL?.trim())
}
const providerName = Object.hasOwn(providers, selected) ? selected : 'supabase'
const provider = providers[providerName]

export const mediaProvider = Object.fromEntries(
  ['getAudioUrl', 'getPodcastAudioUrl', 'getCoverUrl', 'getArtworkUrl'].map(method => [method, value => {
    if (import.meta.env.DEV) console.debug('[MediaProvider]', { provider: providerName, asset: value, method })
    return provider[method](value)
  }])
)
