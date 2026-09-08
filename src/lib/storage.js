export function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
export function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
export const mediaKey = item => `${item?.type === 'episode' || item?.podcast_id ? 'episode' : 'track'}:${item?.id}`
export const mediaUrl = item => item?.audio_url || item?.url || ''
export function validUrl(value) {
  if (!value) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}
