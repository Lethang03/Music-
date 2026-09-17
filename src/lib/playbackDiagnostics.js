import { readStored, writeStored } from './storage'

export const PLAYBACK_DIAGNOSTICS_KEY = 'soundverse_playback_diagnostics'
const MAX_ENTRIES = 200

const safeSource = source => {
  try { const url = new URL(source, window.location.href); return `${url.origin}${url.pathname}` } catch { return '' }
}

// Kept intentionally small and local-only. Query strings are removed because
// audio URLs can be signed; the log remains safe to share from an iPhone.
export function logPlaybackEvent(event, audio, item, detail = '') {
  const previous = readStored(PLAYBACK_DIAGNOSTICS_KEY, [])
  const entries = Array.isArray(previous) ? previous : []
  const entry = {
    timestamp: new Date().toISOString(), event,
    category: event === 'MEDIA_SESSION' ? '[MEDIA_SESSION]' : /PLAY_REQUEST|PLAY_SUCCESS|PLAY_REJECTED/.test(event) ? '[AUDIO_PLAY]' : '[BACKGROUND_PLAYBACK]',
    detail: String(detail || '').slice(0, 240),
    visibilityState: document.visibilityState, trackId: item?.id || '', trackTitle: item?.title || '',
    src: safeSource(audio?.src), paused: Boolean(audio?.paused), currentTime: Number(audio?.currentTime || 0),
    readyState: Number(audio?.readyState || 0), networkState: Number(audio?.networkState || 0),
    volume: Number(audio?.volume ?? 1), muted: Boolean(audio?.muted), audioContextState: 'not-used'
  }
  writeStored(PLAYBACK_DIAGNOSTICS_KEY, [...entries, entry].slice(-MAX_ENTRIES))
  return entry
}
