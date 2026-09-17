# SoundVerse Phase 3: Changelog

This changelog records all modifications made in **SoundVerse Phase 3 — Audio Deduplication System**.

---

## 1. Database Schema & Migrations

### Added Files
- [`PHASE3_DATABASE_MIGRATION.sql`](file:///f:/Music%20GG/PHASE3_DATABASE_MIGRATION.sql)
- [`supabase/migrations/20260918000000_audio_deduplication.sql`](file:///f:/Music%20GG/supabase/migrations/20260918000000_audio_deduplication.sql)

### Changes
- Added columns to `music_tracks`:
  - `audio_hash TEXT`: SHA-256 hash of the converted audio stream
  - `file_size BIGINT`: Audio file size in bytes
  - `audio_mime_type TEXT DEFAULT 'audio/mpeg'`: MIME type for streaming
- Added columns to `episodes`:
  - `audio_hash TEXT`: SHA-256 hash of the episode audio stream
  - `file_size BIGINT`: Episode file size in bytes
- Added column to `import_jobs`:
  - `source_hash TEXT`: SHA-256 hash of the normalized source URL
- Created indices:
  - `idx_music_tracks_audio_hash` on `music_tracks(audio_hash) WHERE audio_hash IS NOT NULL`
  - `idx_episodes_audio_hash` on `episodes(audio_hash) WHERE audio_hash IS NOT NULL`
  - `idx_import_jobs_source_hash` on `import_jobs(source_hash) WHERE source_hash IS NOT NULL`
  - `idx_import_jobs_source_hash_status` on `import_jobs(source_hash, status) WHERE source_hash IS NOT NULL`
- All migration DDL is non-destructive (`IF NOT EXISTS`) preserving 100% of existing rows and storage references.

---

## 2. Ingestion & Edge Function

### Modified File
- [`supabase/functions/import-job/index.ts`](file:///f:/Music%20GG/supabase/functions/import-job/index.ts)

### Changes
- Added `normalizeSourceUrl(inputUrl)`:
  - Detects YouTube hostnames (`youtube.com`, `m.youtube.com`, `youtu.be`).
  - Extracts 11-character video ID from `/watch?v=`, `/shorts/`, `/embed/`, or `youtu.be/`.
  - Maps to canonical format: `https://www.youtube.com/watch?v=<id>`.
  - Strips tracking query parameters (`utm_*`, `si`, `ref`, `feature`, `fbclid`, `gclid`).
  - Lexicographically sorts remaining query parameters.
- Added `computeSourceHash(normalizedUrl)` using Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`).
- Pre-insertion duplicate check: queries `import_jobs` for any job matching `source_hash` with status in `('pending', 'processing', 'extracting', 'uploading', 'completed')`.
  - If found: returns `{ job: existingJob, reused: true }` without creating duplicate row.
  - If not found: persists `source_hash` alongside `source_url`.

---

## 3. Audio Ingestion Workers

### Modified Files
- [`workers/audio-worker/worker.js`](file:///f:/Music%20GG/workers/audio-worker/worker.js)
- [`services/audio-import-worker/index.js`](file:///f:/Music%20GG/services/audio-import-worker/index.js)

### Changes
- Added `computeFileHash(filePath)` using Node.js `crypto.createHash('sha256')`.
- Added `findExistingAudioByHash(supabase, audioHash)`:
  - Queries `music_tracks` for matching `audio_hash` where `audio_url IS NOT NULL`.
  - Queries `episodes` for matching `audio_hash` where `audio_url IS NOT NULL`.
- Transcode workflow update:
  1. Converted output file is read and hashed.
  2. If `findExistingAudioByHash` finds a match:
     - **Skips Supabase Storage upload entirely**.
     - Sets `audio_url` to the existing storage URL.
     - Logs `Deduplication match: Reusing existing storage URL ...`.
  3. If no match is found:
     - Uploads to storage bucket (`music-audio` or `podcast-audio`).
  4. Stores record with `audio_hash`, `file_size`, and `audio_mime_type`.

---

## 4. Frontend Audio Context & Media Session Hardening

### Modified File
- [`src/contexts/AudioContext.jsx`](file:///f:/Music%20GG/src/contexts/AudioContext.jsx)

### Changes
- Added `safeSetPositionState(duration, position, playbackRate)` helper ensuring `duration > 0` and finite numbers before calling `navigator.mediaSession.setPositionState()`.
- Added `stop` action handler to `navigator.mediaSession.setActionHandler`.
- Added `stopping` ref to cleanly transition lockscreen playback state to `'none'` on stop without racing pause events.
- Updated `loadedmetadata` and `seek` to call `safeSetPositionState`.

---

## 5. Automated Test Suites

### Added File
- [`tests/phase3-dedup.spec.js`](file:///f:/Music%20GG/tests/phase3-dedup.spec.js)
  - Canonical YouTube URL normalization test.
  - Generic URL tracking parameter stripping & query sorting test.
  - SHA-256 deterministic content hashing test.
  - Migration SQL structure and index validation test.
  - Audio worker deduplication simulation test (reusing storage URL on identical hash).

---

## 6. Verification Summary

- `tests/phase3-dedup.spec.js`: **5 passed**
- `tests/phase2-playback.spec.js`: **5 passed**
- `tests/lockscreen-playback.spec.js`: **4 passed**
- `tests/v2.spec.js`: **31 passed**
- **Total**: **45 / 45 tests passed**

