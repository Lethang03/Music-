import './config.js'
import { supabase, supabaseReady } from '../src/lib/supabase.js'
import { mediaUrl, validUrl } from '../src/lib/storage.js'
import { createSupabaseMediaProvider } from '../src/services/media/supabaseMediaProvider.js'

const mediaProvider = createSupabaseMediaProvider(process.env.VITE_SUPABASE_URL)

export class AudioTestError extends Error {}

// Catalog metadata may contain URLs; never print a URL or control characters.
export const safeTitle = (title) => String(title || 'Untitled track')
  // eslint-disable-next-line no-control-regex -- Remove terminal control characters from catalog text.
  .replace(/https?:\/\/\S+/gi, '[URL omitted]').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 180)

export function audioSource(track) {
  const value = mediaProvider.getAudioUrl(mediaUrl(track)?.trim())
  if (!value || !validUrl(value)) throw new AudioTestError('Invalid audio URL: expected an absolute HTTP(S) audio source.')
  const url = new URL(value)
  if (url.username || url.password) throw new AudioTestError('Audio URLs with embedded credentials are unsupported.')
  const storage = url.pathname.startsWith('/storage/v1/object/')
  const signed = url.search.length > 0
  return { url: url.href, type: storage ? (signed ? 'Supabase Storage signed URL' : 'Supabase Storage public URL') : (signed ? 'External URL with query parameters' : 'External HTTP(S) URL') }
}

export async function firstMusicTrack(signal) {
  if (!supabaseReady) throw new AudioTestError('Music source not configured: check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
  // Same published filter and ordering as LibraryContext, without loading a queue.
  for (let offset = 0; ; offset += 50) {
    const { data, error, status } = await supabase.from('music_tracks')
      .select('id,title,audio_url,created_at').eq('published', true)
      .order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 49).abortSignal(signal)
    if (signal.aborted) throw new AudioTestError('Music lookup cancelled.')
    if (error) throw new AudioTestError(`Music library query failed (HTTP ${Number(status) || 0}). Check network, public key, and read permissions.`)
    for (const track of data || []) {
      try { return { track, ...audioSource(track) } }
      catch (error) {
        console.warn(`Audio Test: Skipping invalid source for ${safeTitle(track.title)}. ${error instanceof AudioTestError ? error.message : 'Unsupported source.'}`)
      }
    }
    if (!data || data.length < 50) throw new AudioTestError('No published music track with a valid HTTP(S) audio source is available.')
  }
}

export async function getAllMusicTracks(signal) {
  if (!supabaseReady) throw new AudioTestError('Music source not configured: check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
  const tracks = []
  const seen = new Set()
  let total = 0
  let skipped = 0
  for (let offset = 0; ; offset += 50) {
    const { data, error, status } = await supabase.from('music_tracks')
      .select('*').eq('published', true)
      .order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 49).abortSignal(signal)
    if (signal.aborted) throw new AudioTestError('Music lookup cancelled.')
    if (error) throw new AudioTestError(`Music library query failed (HTTP ${Number(status) || 0}). Check network, public key, and read permissions.`)
    for (const track of data || []) {
      if (seen.has(track.id)) continue
      seen.add(track.id)
      total++
      try { audioSource(track); tracks.push(track) }
      catch { skipped++; console.warn(`[SOUNDVERSE] Skipped invalid audio source - ${safeTitle(track.title)}`) }
    }
    if (!data || data.length < 50) break
  }
  console.log(`========================================\nSOUNDVERSE MUSIC LIBRARY\n========================================\nTotal: ${total}\nPlayable: ${tracks.length}\nSkipped: ${skipped}\n========================================`)
  return tracks
}
