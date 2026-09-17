const BUCKET = 'soundverse'

export function createSupabaseMediaProvider(baseUrl) {
  const resolvedCache = new Map()

  const resolve = value => {
    if (!value) return ''
    if (resolvedCache.has(value)) return resolvedCache.get(value)

    let url = value
    if (!/^(?:https?:|blob:|data:|\/)/i.test(value)) {
      const path = value.replace(/^storage:\/\//, '').replace(/^soundverse\//, '')
      if (baseUrl) {
        url = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
      }
    }

    if (resolvedCache.size < 5000) {
      resolvedCache.set(value, url)
    }
    return url
  }
  return { getAudioUrl: resolve, getPodcastAudioUrl: resolve, getCoverUrl: resolve, getArtworkUrl: resolve }
}
