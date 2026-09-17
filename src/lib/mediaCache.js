/**
 * Client-Side Media Cache.
 * Caches album covers, podcast artwork, and thumbnails in memory and Browser Cache API
 * to prevent duplicate image requests and conserve Supabase egress.
 * Note: Never caches mutable user data or private session payloads.
 */

const MEDIA_CACHE_NAME = 'soundverse-media-v1'
const inMemoryCache = new Set()
const urlMap = new Map()

/**
 * Normalizes and deduplicates a media URL.
 */
export function getCanonicalMediaUrl(url) {
  if (!url || typeof url !== 'string') return ''
  if (urlMap.has(url)) return urlMap.get(url)
  
  // Strip ephemeral query parameters from immutable Supabase storage assets
  let canonical = url
  if (url.includes('/storage/v1/object/public/')) {
    try {
      const parsed = new URL(url)
      // Keep pathname intact, drop extraneous cache-busting tokens
      canonical = `${parsed.origin}${parsed.pathname}`
    } catch {
      canonical = url
    }
  }
  
  if (urlMap.size < 2000) {
    urlMap.set(url, canonical)
  }
  return canonical
}

/**
 * Checks if an artwork/cover URL is already in-memory or loaded.
 */
export function isArtworkCached(url) {
  if (!url) return false
  const canonical = getCanonicalMediaUrl(url)
  return inMemoryCache.has(canonical)
}

/**
 * Records an artwork URL as loaded in the client.
 */
export function markArtworkLoaded(url) {
  if (!url) return
  const canonical = getCanonicalMediaUrl(url)
  inMemoryCache.add(canonical)
}

/**
 * Caches a cover/artwork URL in the browser's Cache API.
 * Best-effort: failures never interrupt the user or crash the UI.
 */
export async function cacheMediaImage(url) {
  if (!url || typeof window === 'undefined' || !('caches' in window)) return url
  const canonical = getCanonicalMediaUrl(url)
  
  if (inMemoryCache.has(canonical)) return canonical

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME)
    const match = await cache.match(canonical)
    if (match) {
      inMemoryCache.add(canonical)
      return canonical
    }

    // Only cache static public assets (HTTP/HTTPS)
    if (canonical.startsWith('http')) {
      const response = await fetch(canonical, { mode: 'no-cors', cache: 'force-cache' })
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(canonical, response.clone())
        inMemoryCache.add(canonical)
      }
    }
  } catch {
    // Ignore cache storage errors (e.g. incognito quota restriction)
  }

  return canonical
}

/**
 * Preloads an artwork image in the background without duplicate fetches.
 */
export function preloadArtwork(url) {
  if (!url || typeof window === 'undefined') return
  const canonical = getCanonicalMediaUrl(url)
  if (inMemoryCache.has(canonical)) return

  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    inMemoryCache.add(canonical)
    void cacheMediaImage(canonical)
  }
  img.src = canonical
}

