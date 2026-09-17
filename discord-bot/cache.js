import { mkdir, stat, readdir, unlink, rename, utimes } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'
import { AudioTestError } from './music-source.js'

// Default cache directory: cache/audio/ at project root
const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../cache/audio', import.meta.url))
// Default max cache size: 500 MB
const DEFAULT_MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024

export class AudioCacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || process.env.AUDIO_CACHE_DIR || DEFAULT_CACHE_DIR
    this.maxCacheSizeBytes = options.maxCacheSizeBytes || Number(process.env.AUDIO_CACHE_MAX_SIZE_BYTES) || DEFAULT_MAX_CACHE_SIZE_BYTES
    this.activeDownloads = new Map()
    this._initPromise = null
  }

  async ensureCacheDir() {
    if (!this._initPromise) {
      this._initPromise = mkdir(this.cacheDir, { recursive: true }).catch((err) => {
        this._initPromise = null
        throw err
      })
    }
    return this._initPromise
  }

  getCacheKey(source) {
    if (source.track?.audio_hash) {
      return `hash_${source.track.audio_hash}`
    }
    if (source.track?.id) {
      const cleanId = String(source.track.id).replace(/[^a-zA-Z0-9_-]/g, '_')
      return `track_${cleanId}`
    }
    const cleanUrl = (source.url || '').split('?')[0]
    const hash = crypto.createHash('sha256').update(cleanUrl).digest('hex')
    return `url_${hash.slice(0, 32)}`
  }

  getCacheFilePath(source) {
    const key = this.getCacheKey(source)
    return path.join(this.cacheDir, `${key}.audio`)
  }

  async get(source) {
    try {
      const filePath = this.getCacheFilePath(source)
      const fileStat = await stat(filePath)
      if (fileStat.isFile() && fileStat.size > 0) {
        // Touch access and modification time for LRU eviction tracking across all OS platforms
        const now = new Date()
        await utimes(filePath, now, now).catch(() => {})
        return filePath
      }
      return null
    } catch {
      return null
    }
  }

  async downloadAndCache(source, signal) {
    // 1. Return immediately if already cached
    const existing = await this.get(source)
    if (existing) return existing

    const cacheKey = this.getCacheKey(source)
    // 2. Reuse in-flight download if identical track is already being fetched
    if (this.activeDownloads.has(cacheKey)) {
      return this.activeDownloads.get(cacheKey)
    }

    const downloadPromise = (async () => {
      await this.ensureCacheDir()
      const targetPath = this.getCacheFilePath(source)
      const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`

      let response
      try {
        response = await fetch(source.url, { signal })
      } catch (err) {
        if (signal?.aborted) throw err
        throw new AudioTestError('HTTP/network error while opening the audio source. Check connectivity, URL expiry, and access.')
      }

      if (!response.ok) {
        throw new AudioTestError(`Audio source inaccessible (HTTP ${response.status}). Check file access or URL expiry.`)
      }
      if (!response.body) {
        throw new AudioTestError('Audio source returned an empty response body.')
      }
      if (/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) {
        throw new AudioTestError('Audio source returned HTML/JSON instead of an audio file.')
      }

      const fileWriteStream = createWriteStream(tempPath)
      try {
        const bodyStream = Readable.fromWeb(response.body)
        // Stream pipeline handles chunk-by-chunk download with backpressure directly to disk
        await pipeline(bodyStream, fileWriteStream, { signal })

        // Verify written file
        const writtenStat = await stat(tempPath)
        if (writtenStat.size === 0) {
          throw new AudioTestError('Audio source returned zero bytes.')
        }

        // Atomically commit to permanent cache file
        await rename(tempPath, targetPath)
        return targetPath
      } catch (err) {
        // Cleanup partial temp file on failure or abort
        await unlink(tempPath).catch(() => {})
        throw err
      }
    })()

    this.activeDownloads.set(cacheKey, downloadPromise)
    try {
      return await downloadPromise
    } finally {
      this.activeDownloads.delete(cacheKey)
    }
  }

  async prune(maxBytes = this.maxCacheSizeBytes, targetRatio = 0.8) {
    try {
      await this.ensureCacheDir()
      const entries = await readdir(this.cacheDir)
      const now = Date.now()
      const tenMinutesAgo = now - 10 * 60 * 1000

      const cachedFiles = []
      let totalSize = 0

      for (const file of entries) {
        const fullPath = path.join(this.cacheDir, file)
        try {
          const fileStat = await stat(fullPath)
          if (!fileStat.isFile()) continue

          // Remove stale orphaned temp files older than 10 minutes
          if (file.includes('.tmp.')) {
            if (fileStat.mtimeMs < tenMinutesAgo) {
              await unlink(fullPath).catch(() => {})
            }
            continue
          }

          if (file.endsWith('.audio')) {
            const timestamp = Math.max(fileStat.atimeMs || 0, fileStat.mtimeMs || 0)
            cachedFiles.push({
              path: fullPath,
              size: fileStat.size,
              timestamp,
            })
            totalSize += fileStat.size
          }
        } catch {
          // File may have been unlinked concurrently
        }
      }

      let prunedBytes = 0
      let prunedCount = 0

      if (totalSize > maxBytes) {
        const targetSize = Math.floor(maxBytes * targetRatio)
        // Sort ascending by timestamp (oldest accessed/modified file first -> LRU)
        cachedFiles.sort((a, b) => a.timestamp - b.timestamp)

        for (const file of cachedFiles) {
          if (totalSize <= targetSize) break
          try {
            await unlink(file.path)
            totalSize -= file.size
            prunedBytes += file.size
            prunedCount++
          } catch {
            // Ignore concurrent unlink error
          }
        }
      }

      return { totalSize, prunedCount, prunedBytes }
    } catch {
      return { totalSize: 0, prunedCount: 0, prunedBytes: 0 }
    }
  }

  async getCacheStats() {
    try {
      await this.ensureCacheDir()
      const entries = await readdir(this.cacheDir)
      let count = 0
      let totalBytes = 0

      for (const file of entries) {
        if (!file.endsWith('.audio')) continue
        try {
          const s = await stat(path.join(this.cacheDir, file))
          if (s.isFile()) {
            count++
            totalBytes += s.size
          }
        } catch {}
      }
      return { fileCount: count, totalSizeBytes: totalBytes, cacheDir: this.cacheDir, maxCacheSizeBytes: this.maxCacheSizeBytes }
    } catch {
      return { fileCount: 0, totalSizeBytes: 0, cacheDir: this.cacheDir, maxCacheSizeBytes: this.maxCacheSizeBytes }
    }
  }

  async clear() {
    try {
      await this.ensureCacheDir()
      const entries = await readdir(this.cacheDir)
      for (const file of entries) {
        if (file.endsWith('.audio') || file.includes('.tmp.')) {
          await unlink(path.join(this.cacheDir, file)).catch(() => {})
        }
      }
    } catch {}
  }
}

export const audioCache = new AudioCacheManager()
