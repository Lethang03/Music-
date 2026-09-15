import { supabase } from './supabase'
import { validateAndAlignTimestamps, calculateSyncQuality, toLrc, splitLyricsToLines } from './lyrics'

/**
 * Validates whether a URL is a valid public YouTube URL.
 */
export function validateYouTubeUrl(value) {
  let url
  try {
    url = new URL(String(value).trim())
  } catch {
    throw new Error('Enter a valid YouTube URL.')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Enter an HTTP or HTTPS YouTube URL.')
  }
  const host = url.hostname.toLowerCase()
  let sourceId = null
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'].includes(host)) {
    sourceId = host.endsWith('youtu.be')
      ? url.pathname.match(/^\/([\w-]{11})\/?$/)?.[1]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)?.[1]
    if (!sourceId || !/^[\w-]{11}$/.test(sourceId)) {
      throw new Error('Enter a YouTube video, Shorts or youtu.be URL with a valid 11-character video ID.')
    }
    return {
      source_url: `https://www.youtube.com/watch?v=${sourceId}`,
      source_platform: 'youtube',
      source_id: sourceId
    }
  }
  throw new Error('Only YouTube URLs are supported for lyrics synchronization.')
}

/**
 * Discovers the authorized YouTube source URL for an existing track.
 */
export async function discoverTrackSource(track) {
  if (!track) return null

  // 1. Direct fields on the track
  const directCandidate = track.lyrics_sync_source_url || track.source_url
  if (directCandidate) {
    try {
      const validated = validateYouTubeUrl(directCandidate)
      return { ...validated, detectedFrom: 'track' }
    } catch {
      // Continue to check other sources
    }
  }

  // 2. Query import_jobs if track originated from an import
  if (track.import_job_id) {
    try {
      const { data: job, error } = await supabase
        .from('import_jobs')
        .select('source_url, source_platform, source_id')
        .eq('id', track.import_job_id)
        .maybeSingle()

      if (!error && job?.source_url) {
        try {
          const validated = validateYouTubeUrl(job.source_url)
          return { ...validated, detectedFrom: 'import_job' }
        } catch {
          // not a valid youtube url
        }
      }
    } catch (err) {
      console.warn('Unable to query import_jobs for track source:', err)
    }
  }

  return null
}

/**
 * High-level function to align a track's existing plain lyrics using Gemini and an authorized YouTube video.
 */
export async function alignTrackLyricsWithGemini({ track, sourceUrl, onProgress }) {
  if (!track) throw new Error('No track provided.')

  const canonicalLines = splitLyricsToLines(track.lyrics)
  if (!canonicalLines.length) {
    throw new Error('Lyrics required before sync. Please add plain lyrics first.')
  }

  const validatedSource = validateYouTubeUrl(sourceUrl)
  onProgress?.({ step: 1, label: 'Source detected', detail: validatedSource.source_url })

  onProgress?.({ step: 2, label: 'Analyzing timing with Gemini...', detail: 'Aligning canonical lyric lines to audio' })

  // Invoke secure server-side Edge Function
  const { data, error } = await supabase.functions.invoke('align-lyrics', {
    body: {
      track_id: track.id,
      source_url: validatedSource.source_url,
      lyrics: track.lyrics,
      title: track.title,
      artist: track.artist,
      duration: track.duration
    }
  })

  if (error) {
    let message = error.message || 'Gemini alignment service error.'
    if (typeof error?.context?.clone === 'function') {
      try {
        const details = await error.context.clone().json()
        if (details?.error) message = details.error
      } catch {
        // use fallback message
      }
    }
    throw new Error(message)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  const rawAlignment = data?.raw_alignment
  if (!Array.isArray(rawAlignment)) {
    throw new Error('Gemini returned an invalid alignment structure.')
  }

  onProgress?.({ step: 3, label: 'Validating timestamps and quality...', detail: `${rawAlignment.length} lines received` })

  // Validate timestamps, enforcing monotonicity, duration bounds, and canonical text preservation
  const alignedLyrics = validateAndAlignTimestamps(track.lyrics, rawAlignment, {
    trackDuration: track.duration
  })

  // Calculate quality metrics
  const quality = calculateSyncQuality(track.lyrics, alignedLyrics, {
    trackDuration: track.duration,
    sourceDuration: data.detected_duration
  })

  const lrc = toLrc(alignedLyrics)

  onProgress?.({ step: 4, label: 'Alignment complete', detail: `${quality.alignedLines} lines aligned (${quality.status})` })

  return {
    success: true,
    synced_lyrics: alignedLyrics,
    lrc,
    quality,
    source_url: validatedSource.source_url,
    source_platform: 'youtube',
    source_id: validatedSource.source_id
  }
}

/**
 * Batch synchronization controller for processing multiple tracks with low concurrency.
 */
export class BatchLyricsSyncRunner {
  constructor({ tracks, options = {}, onProgress, onTrackUpdate, onComplete }) {
    this.tracks = tracks || []
    this.options = {
      concurrency: Math.min(2, Math.max(1, options.concurrency || 1)),
      forceResync: Boolean(options.forceResync),
      autoSave: Boolean(options.autoSave),
      ...options
    }
    this.onProgress = onProgress
    this.onTrackUpdate = onTrackUpdate
    this.onComplete = onComplete

    this.status = 'idle' // 'idle' | 'running' | 'paused' | 'completed' | 'stopped'
    this.queue = []
    this.items = new Map() // trackId -> status object
    this.activeWorkers = 0
  }

  init() {
    this.queue = []
    this.items.clear()

    for (const track of this.tracks) {
      const hasPlainLyrics = Boolean(splitLyricsToLines(track.lyrics).length)
      const hasSynced = track.lyrics_type === 'synced' && Array.isArray(track.synced_lyrics) && track.synced_lyrics.length > 0

      const isEligible = hasPlainLyrics && (this.options.forceResync || !hasSynced)

      if (isEligible) {
        const item = {
          track,
          status: 'queued', // 'queued' | 'analyzing' | 'completed' | 'needs_review' | 'failed'
          progress: 0,
          error: null,
          quality: null,
          result: null
        }
        this.items.set(track.id, item)
        this.queue.push(track.id)
      }
    }

    this._notifyProgress()
  }

  getEligibleCount() {
    return this.queue.length
  }

  start() {
    if (this.status === 'running') return
    this.status = 'running'
    this._drainQueue()
  }

  pause() {
    if (this.status === 'running') {
      this.status = 'paused'
      this._notifyProgress()
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running'
      this._drainQueue()
    }
  }

  stop() {
    this.status = 'stopped'
    this.queue = []
    this._notifyProgress()
  }

  retryFailed() {
    for (const [id, item] of this.items.entries()) {
      if (item.status === 'failed') {
        item.status = 'queued'
        item.error = null
        if (!this.queue.includes(id)) {
          this.queue.push(id)
        }
        this.onTrackUpdate?.(item)
      }
    }
    if (this.status !== 'running') {
      this.start()
    }
  }

  async _drainQueue() {
    if (this.status !== 'running') return

    while (this.activeWorkers < this.options.concurrency && this.queue.length > 0) {
      const trackId = this.queue.shift()
      const item = this.items.get(trackId)
      if (!item) continue

      this.activeWorkers++
      this._processItem(item).finally(() => {
        this.activeWorkers--
        if (this.status === 'running') {
          this._drainQueue()
        }
        if (this.activeWorkers === 0 && this.queue.length === 0 && this.status !== 'paused') {
          this.status = 'completed'
          this._notifyProgress()
          this.onComplete?.(this.getStats())
        }
      })
    }
  }

  async _processItem(item) {
    item.status = 'analyzing'
    item.progress = 10
    this.onTrackUpdate?.(item)
    this._notifyProgress()

    try {
      // 1. Discover source
      const source = await discoverTrackSource(item.track)
      if (!source?.source_url) {
        throw new Error('No authorized YouTube source URL found. Please provide one manually.')
      }

      item.progress = 30
      this.onTrackUpdate?.(item)

      // 2. Run alignment
      const result = await alignTrackLyricsWithGemini({
        track: item.track,
        sourceUrl: source.source_url,
        onProgress: (p) => {
          item.progress = Math.min(90, 30 + p.step * 15)
          this.onTrackUpdate?.(item)
        }
      })

      item.result = result
      item.quality = result.quality

      // 3. Determine status based on quality
      if (result.quality.status === 'failed') {
        item.status = 'failed'
        item.error = 'Alignment quality check failed: too many lines unmatched.'
      } else if (result.quality.status === 'needs_review') {
        item.status = 'needs_review'
      } else {
        item.status = 'completed'
      }

      // 4. Auto-save policy (only save if autoSave is on AND quality is high)
      if (this.options.autoSave && item.status === 'completed') {
        await supabase
          .from('music_tracks')
          .update({
            lyrics_type: 'synced',
            synced_lyrics: result.synced_lyrics,
            lyrics_sync_confidence: result.quality.averageConfidence,
            lyrics_synced_at: new Date().toISOString(),
            lyrics_sync_source_url: result.source_url
          })
          .eq('id', item.track.id)
      }

      item.progress = 100
    } catch (err) {
      item.status = 'failed'
      item.error = err.message || 'Alignment failed.'
      item.progress = 0
    }

    this.onTrackUpdate?.(item)
    this._notifyProgress()
  }

  getStats() {
    const list = Array.from(this.items.values())
    const completed = list.filter(i => i.status === 'completed').length
    const needsReview = list.filter(i => i.status === 'needs_review').length
    const failed = list.filter(i => i.status === 'failed').length
    const queued = list.filter(i => i.status === 'queued').length
    const analyzing = list.filter(i => i.status === 'analyzing').length
    const total = list.length

    return {
      status: this.status,
      total,
      completed,
      needsReview,
      failed,
      queued,
      analyzing,
      percent: total > 0 ? Math.round(((completed + needsReview + failed) / total) * 100) : 0
    }
  }

  _notifyProgress() {
    this.onProgress?.(this.getStats())
  }
}

