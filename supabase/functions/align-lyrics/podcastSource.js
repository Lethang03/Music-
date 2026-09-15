// Deployment-local mirror of workers/audio-worker/podcastSource.js.
// Feature tests verify both validators agree. Exact host and path checks
// keep arbitrary external targets out of the podcast media extractor.
export function validatePodcastSource(value) {
  let url
  try { url = new URL(String(value).trim()) } catch { throw new Error('Enter a valid TikTok or YouTube URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Enter a public TikTok or YouTube URL without credentials or custom ports.')
  const host = url.hostname.toLowerCase()
  let platform; let sourceId = null
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(host)) {
    platform = 'youtube'
    sourceId = host.endsWith('youtu.be') ? url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1] : url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1]
    if (!sourceId || !/^[\w-]{11}$/.test(sourceId)) throw new Error('Enter a YouTube video, Shorts or youtu.be URL.')
    url = new URL(`https://www.youtube.com/watch?v=${sourceId}`)
  } else if (['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(host)) {
    platform = 'tiktok'
    sourceId = url.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/)?.[1]
    if (!sourceId) throw new Error('Enter a TikTok video URL.')
    url.search = ''; url.hash = ''; url.protocol = 'https:'
  } else if (['vm.tiktok.com', 'vt.tiktok.com'].includes(host) && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) {
    platform = 'tiktok'; url.search = ''; url.hash = ''; url.protocol = 'https:'
  } else throw new Error('Only public TikTok and YouTube video URLs are supported.')
  return { source_url: url.toString(), source_platform: platform, source_id: sourceId }
}

