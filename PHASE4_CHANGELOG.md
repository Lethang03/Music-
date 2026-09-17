# SoundVerse Phase 4: Changelog

This changelog records all modifications made in **SoundVerse Phase 4 — Discord Bot Audio Optimization**.

---

## 1. Local Audio Cache Manager

### Added Files
- [`discord-bot/cache.js`](file:///f:/Music%20GG/discord-bot/cache.js)

### Features & Logic
- Implemented `AudioCacheManager`:
  - `ensureCacheDir()`: Guarantees cache directory exists (defaults to `cache/audio/`).
  - `getCacheKey(source)`: Generates consistent keys via Phase 3 `source.track.audio_hash`, `source.track.id`, or SHA-256 of `source.url` (query parameters stripped).
  - `get(source)`: Looks up cached file; updates access time (`utimes`) for LRU tracking.
  - `downloadAndCache(source, signal)`: Fetches source stream and downloads directly to an atomic `.tmp` file using `stream.pipeline` with native backpressure; renames to `.audio` upon byte verification. Discards temp file on failure or abort.
  - `activeDownloads` map: Deduplicates concurrent requests for the same track so parallel playback shares a single download.
  - `prune(maxBytes, targetRatio)`: Enforces max disk cache size (default: 500 MB) by sorting files by access/modification timestamp and removing oldest files until usage <= 80% of max.
  - Orphaned `.tmp` garbage collection: Unlinks temporary files older than 10 minutes.
  - `getCacheStats()`: Returns cache file count, total bytes, cache directory, and configured max size.
  - `clear()`: Cleans all cached audio files (used in tests and maintenance).

---

## 2. Discord Bot Audio Player Integration

### Modified Files
- [`discord-bot/audio.js`](file:///f:/Music%20GG/discord-bot/audio.js)

### Changes
- Imported `createReadStream` from `'node:fs'` and `audioCache` from `'./cache.js'`.
- In `play(source, connection, onPlaying)` -> `start()`:
  - Check local cache:
    - **Cache HIT**: Logs `[SOUNDVERSE] Cache HIT - ${title} | Streaming from local cache`. Bypasses `fetch()` entirely.
    - **Cache MISS**: Logs `[SOUNDVERSE] Cache MISS - ${title} | Downloading once to local cache`. Downloads once via `audioCache.downloadAndCache()`, then schedules background `audioCache.prune()`.
  - Stream pipeline playback:
    - Creates read stream via `input = createReadStream(cachedFilePath)`.
    - Directly feeds `input` to FFmpeg decoder `stdin` via `pipeline(input, decoder.stdin)`.
    - Handles stall detection and backpressure.
    - Added clean stream teardown (`input?.destroy()`) on cleanup.
- Exported `audioCache` for external testing and stats inspection.

---

## 3. Git Configuration

### Modified Files
- [`.gitignore`](file:///f:/Music%20GG/.gitignore)

### Changes
- Added `cache/` and `discord-bot/cache/` to ignore cached audio assets from git tracking.

---

## 4. Test Suites

### Added Files
- [`tests/discord-audio-cache.test.mjs`](file:///f:/Music%20GG/tests/discord-audio-cache.test.mjs)
  - Auto-creation of cache directory (`cache/audio`).
  - Deterministic key derivation tests across hashes, IDs, and URLs.
  - Cache MISS followed by Cache HIT (verifying 0 subsequent fetches).
  - In-flight concurrent download deduplication.
  - LRU cache eviction and disk size limit enforcement.
  - Aborted download temp file cleanup.

### Modified Files
- [`tests/discord-audio.test.mjs`](file:///f:/Music%20GG/tests/discord-audio.test.mjs)
  - Updated mock test to clear cache before executing simulated HTTP 403 test.

---

## 5. Verification Results

- `tests/discord-audio-cache.test.mjs`: **7 / 7 passed**
- `tests/discord-*.test.mjs` (All 8 test files): **16 / 16 passed**
- `tests/phase3-dedup.spec.js`: **5 / 5 passed**
- `tests/lockscreen-playback.spec.js`: **4 / 4 passed**
- `tests/phase2-playback.spec.js`: **5 / 5 passed**
- `npm run build`: **Vite build passed** (3.11s)

