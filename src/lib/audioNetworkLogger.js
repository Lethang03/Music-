// Development audio network logger & duplicate download detector
// Tracks every audio URL requested by the player, counts requests, and flags duplicate downloads.

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV

const stats = {
  totalRequests: 0,
  duplicateRequests: 0,
  activeUrl: '',
  activeTitle: '',
  history: []
}

export function recordAudioRequest({ url, title = 'Unknown Track', initiator = 'load' }) {
  if (!url) return { isDuplicate: false }

  stats.totalRequests++
  const now = Date.now()
  const cleanUrl = url.split('?')[0]
  
  // Check if identical clean URL is already active or was loaded in the last 15 seconds
  const lastRequest = stats.history.slice().reverse().find(entry => entry.cleanUrl === cleanUrl)
  const isDuplicate = Boolean(
    lastRequest && (now - lastRequest.timestamp < 15000 || stats.activeUrl === cleanUrl)
  )

  if (isDuplicate) {
    stats.duplicateRequests++
  }

  const record = {
    index: stats.totalRequests,
    timestamp: now,
    cleanUrl,
    url,
    title,
    initiator,
    isDuplicate,
    timeSinceLastMs: lastRequest ? now - lastRequest.timestamp : null
  }

  stats.history.push(record)
  if (stats.history.length > 100) stats.history.shift()
  stats.activeUrl = cleanUrl
  stats.activeTitle = title

  if (isDev || typeof window !== 'undefined' && window.__SOUNDVERSE_DEBUG_AUDIO__) {
    if (isDuplicate) {
      console.warn(
        `%c[Audio Network] ⚠️ DUPLICATE AUDIO REQUEST DETECTED (#${stats.duplicateRequests})%c\n` +
        `Track: "${title}"\n` +
        `Initiator: ${initiator}\n` +
        `Time since last request: ${record.timeSinceLastMs}ms\n` +
        `URL: ${cleanUrl}`,
        'background: #ef4444; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: inherit;'
      )
    } else {
      console.log(
        `%c[Audio Network] 🎵 Audio Load #${stats.totalRequests}: "${title}"%c [${initiator}]`,
        'background: #10b981; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
        'color: #9ca3af;'
      )
    }
  }

  return { isDuplicate, totalRequests: stats.totalRequests, duplicateRequests: stats.duplicateRequests }
}

export function getAudioNetworkStats() {
  return { ...stats }
}

export function resetAudioNetworkStats() {
  stats.totalRequests = 0
  stats.duplicateRequests = 0
  stats.activeUrl = ''
  stats.activeTitle = ''
  stats.history = []
}

if (typeof window !== 'undefined') {
  window.__soundverse_audio_stats__ = {
    get: getAudioNetworkStats,
    reset: resetAudioNetworkStats,
    print: () => {
      console.table(stats.history.map(h => ({
        '#': h.index,
        'Title': h.title,
        'Duplicate?': h.isDuplicate ? '⚠️ YES' : '✅ NO',
        'Initiator': h.initiator,
        'Time (ms)': h.timeSinceLastMs ?? 'First',
        'URL': h.cleanUrl
      })))
      console.log(`Total Requests: ${stats.totalRequests} | Duplicates: ${stats.duplicateRequests}`)
    }
  }
}

