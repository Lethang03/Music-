import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm, mkdir, writeFile, stat, readdir, utimes } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AudioCacheManager } from '../discord-bot/cache.js'

const TEST_CACHE_DIR = fileURLToPath(new URL('../cache/test_audio', import.meta.url))

test('AudioCacheManager: directory creation, cache keys and hit/miss lifecycle', async (t) => {
  // Clean test directory
  await rm(TEST_CACHE_DIR, { recursive: true, force: true }).catch(() => {})
  const cache = new AudioCacheManager({
    cacheDir: TEST_CACHE_DIR,
    maxCacheSizeBytes: 1024 * 1024, // 1 MB limit for test
  })

  await t.test('ensures cache directory is created', async () => {
    await cache.ensureCacheDir()
    const s = await stat(TEST_CACHE_DIR)
    assert.ok(s.isDirectory(), 'Cache dir should be a directory')
  })

  await t.test('generates deterministic cache keys', () => {
    // 1. With audio_hash (Phase 3 integration)
    const src1 = { track: { id: 'uuid-1', audio_hash: 'a1b2c3d4e5f6', title: 'Song 1' }, url: 'https://example.com/audio1.mp3' }
    assert.equal(cache.getCacheKey(src1), 'hash_a1b2c3d4e5f6')

    // 2. With track id
    const src2 = { track: { id: 'track-123-abc', title: 'Song 2' }, url: 'https://example.com/audio2.mp3' }
    assert.equal(cache.getCacheKey(src2), 'track_track-123-abc')

    // 3. Fallback with URL (strips query parameters)
    const src3 = { url: 'https://example.com/audio3.mp3?token=secret&expiry=123' }
    const key3 = cache.getCacheKey(src3)
    assert.match(key3, /^url_[a-f0-9]{32}$/)

    // Same URL with different query parameters produces the same key
    const src3b = { url: 'https://example.com/audio3.mp3?different=param' }
    assert.equal(cache.getCacheKey(src3b), key3)
  })

  await t.test('cache miss downloads once, subsequent play is cache hit with zero network requests', async () => {
    let fetchCount = 0
    const fakeAudioData = Buffer.from('FAKE_AUDIO_DATA_FOR_TESTING_PURPOSES')
    const originalFetch = globalThis.fetch

    globalThis.fetch = async (url) => {
      fetchCount++
      return new Response(fakeAudioData, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    }

    try {
      const source = {
        track: { id: 'hit-miss-test', audio_hash: 'hash-test-123', title: 'Hit Miss Song' },
        url: 'https://example.invalid/song.mp3',
      }

      // Check initial state: should be MISS (null)
      const initialGet = await cache.get(source)
      assert.equal(initialGet, null, 'Initial cache lookup should be null')

      // 1st request: MISS -> download and cache
      const cachedPath1 = await cache.downloadAndCache(source)
      assert.ok(cachedPath1.endsWith('hash_hash-test-123.audio'))
      assert.equal(fetchCount, 1, 'Fetch should be called once on miss')

      const stat1 = await stat(cachedPath1)
      assert.equal(stat1.size, fakeAudioData.length)

      // 2nd request: HIT -> get() returns path, downloadAndCache returns immediately
      const cachedPath2 = await cache.get(source)
      assert.equal(cachedPath2, cachedPath1)

      const cachedPath3 = await cache.downloadAndCache(source)
      assert.equal(cachedPath3, cachedPath1)
      assert.equal(fetchCount, 1, 'Fetch must NOT be called again on cache hit (0 egress!)')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await t.test('concurrent requests for the same uncached track reuse in-flight download', async () => {
    let fetchCount = 0
    const fakeAudioData = Buffer.from('CONCURRENT_AUDIO_DATA_STREAM')
    const originalFetch = globalThis.fetch

    globalThis.fetch = async () => {
      fetchCount++
      // Simulate network delay
      await new Promise(r => setTimeout(r, 50))
      return new Response(fakeAudioData, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    }

    try {
      const source = {
        track: { id: 'concurrent-test', audio_hash: 'concurrent-hash-456' },
        url: 'https://example.invalid/concurrent.mp3',
      }

      // Launch 3 simultaneous downloads
      const [res1, res2, res3] = await Promise.all([
        cache.downloadAndCache(source),
        cache.downloadAndCache(source),
        cache.downloadAndCache(source),
      ])

      assert.equal(res1, res2)
      assert.equal(res2, res3)
      assert.equal(fetchCount, 1, 'Only 1 fetch request should occur for concurrent plays')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await t.test('LRU cache eviction respects maxCacheSizeBytes and prunes oldest accessed files', async () => {
    // Set tight limit: 300 bytes
    const smallCache = new AudioCacheManager({
      cacheDir: TEST_CACHE_DIR,
      maxCacheSizeBytes: 300,
    })
    await smallCache.clear()

    // Create 4 files, 100 bytes each (Total 400 bytes > 300 bytes max)
    const file1 = path.join(TEST_CACHE_DIR, 'hash_file1.audio')
    const file2 = path.join(TEST_CACHE_DIR, 'hash_file2.audio')
    const file3 = path.join(TEST_CACHE_DIR, 'hash_file3.audio')
    const file4 = path.join(TEST_CACHE_DIR, 'hash_file4.audio')

    const data = Buffer.alloc(100, 'x')
    await writeFile(file1, data)
    await writeFile(file2, data)
    await writeFile(file3, data)
    await writeFile(file4, data)

    // Set access times (atime): file1 oldest (1000s ago), file2 (500s ago), file3 (100s ago), file4 newest (now)
    const now = Date.now() / 1000
    await utimes(file1, now - 1000, now - 1000)
    await utimes(file2, now - 500, now - 500)
    await utimes(file3, now - 100, now - 100)
    await utimes(file4, now, now)

    // Prune cache: target is 300 * 0.8 = 240 bytes
    // Oldest file1 (100b) and file2 (100b) must be evicted, leaving file3 and file4 (200b <= 240b)
    const result = await smallCache.prune(300, 0.8)
    assert.equal(result.prunedCount, 2, 'Should prune 2 oldest files')
    assert.equal(result.prunedBytes, 200, 'Should prune 200 bytes')

    const remaining = await readdir(TEST_CACHE_DIR)
    assert.ok(!remaining.includes('hash_file1.audio'), 'file1 should be deleted (oldest LRU)')
    assert.ok(!remaining.includes('hash_file2.audio'), 'file2 should be deleted (second oldest LRU)')
    assert.ok(remaining.includes('hash_file3.audio'), 'file3 should be retained')
    assert.ok(remaining.includes('hash_file4.audio'), 'file4 should be retained')
  })

  await t.test('cleans up aborted download temp files and leaves no corrupt cache', async () => {
    const originalFetch = globalThis.fetch
    const controller = new AbortController()

    globalThis.fetch = async (_, { signal }) => {
      // Stream that aborts after sending some bytes
      const { ReadableStream } = globalThis
      const stream = new ReadableStream({
        start(controllerStream) {
          controllerStream.enqueue(Buffer.from('PARTIAL'))
        },
      })
      signal.addEventListener('abort', () => {
        // aborted
      })
      return new Response(stream, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }

    try {
      const source = { track: { id: 'abort-test' }, url: 'https://example.invalid/abort.mp3' }
      const downloadPromise = cache.downloadAndCache(source, controller.signal)
      // Abort immediately
      setTimeout(() => controller.abort(), 10)

      await assert.rejects(async () => {
        await downloadPromise
      })

      // Ensure no temp file remained
      const files = await readdir(TEST_CACHE_DIR)
      const tempFiles = files.filter(f => f.includes('.tmp.'))
      assert.equal(tempFiles.length, 0, 'Temporary files must be discarded on abort')

      // Ensure cache still reports null
      const check = await cache.get(source)
      assert.equal(check, null, 'Cache must not store incomplete/aborted files')
    } finally {
      globalThis.fetch = originalFetch
      // Cleanup test dir
      await rm(TEST_CACHE_DIR, { recursive: true, force: true }).catch(() => {})
    }
  })
})
