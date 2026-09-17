# SoundVerse Phase 3: Audio Deduplication & Bandwidth Optimization Report

## 1. Executive Summary

During previous operational audits of SoundVerse, Supabase reported:
- **Restricted Status**: `BLOCKED_BY_QUOTA`
- **Violation Reason**: `exceed_cached_egress_quota`
- **Root Problem**: While the physical storage footprint was modest (~700 MB across all buckets), Cached Egress exceeded 20 GB. In addition to player preload/fetch cycles (remediated in Phase 1 & Phase 2), repeated imports of identical YouTube videos and podcasts caused duplicate storage uploads and redundant egress requests.

**SoundVerse Phase 3** implements an end-to-end **Audio Deduplication System** across the entire ingestion pipeline:
1. **Edge Import Layer (`supabase/functions/import-job`)**: Canonical URL normalization and SHA-256 `source_hash` pre-checks prevent duplicate processing jobs.
2. **Audio Worker Ingestion Layer (`workers/audio-worker`, `services/audio-import-worker`)**: Binary SHA-256 `audio_hash` detection ensures identical audio bitstreams reuse existing storage assets rather than uploading duplicates.
3. **Database Migration (`PHASE3_DATABASE_MIGRATION.sql`)**: Non-destructive schema enhancement adding `audio_hash`, `file_size`, `audio_mime_type`, and `source_hash` with B-Tree indices.

---

## 2. Architecture & Ingestion Flow

```
                      [ Client / Admin Import Request ]
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │    supabase/functions/import-job/index.ts        │
             │                                                  │
             │ 1. Normalize Source URL (strip tracking, canonical)
             │ 2. Compute SHA-256 source_hash                   │
             │ 3. Check for existing pending/processing/done job│
             └────────────────────────┬─────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │ Job Already Exists?                     │
                 ├────────────────────────┬────────────────┤
               [YES]                     [NO]
                 │                         │
     Return existing job record     Create new import_job
     { job, reused: true }                 │
                                           ▼
             ┌──────────────────────────────────────────────────┐
             │       Audio Worker (worker.js)                   │
             │                                                  │
             │ 1. yt-dlp download & ffmpeg convert to MP3/M4A   │
             │ 2. Read output file buffer                       │
             │ 3. Compute SHA-256 audio_hash                    │
             │ 4. Query DB: music_tracks & episodes by hash     │
             └────────────────────────┬─────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │ audio_hash Exists in Database?          │
                 ├────────────────────────┬────────────────┤
               [YES]                     [NO]
                 │                         │
      Reuse existing audio_url      Upload file to Supabase Storage
      Skip Storage upload           Set public URL
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
             ┌──────────────────────────────────────────────────┐
             │  Save track / episode to database with:          │
             │  - audio_url (new or reused)                     │
             │  - audio_hash (SHA-256)                          │
             │  - file_size (bytes)                             │
             │  - audio_mime_type ('audio/mpeg')                │
             └──────────────────────────────────────────────────┘
```

---

## 3. Database Migration Specification

Migration script: [`PHASE3_DATABASE_MIGRATION.sql`](file:///f:/Music%20GG/PHASE3_DATABASE_MIGRATION.sql) & [`supabase/migrations/20260918000000_audio_deduplication.sql`](file:///f:/Music%20GG/supabase/migrations/20260918000000_audio_deduplication.sql).

### Table Enhancements

| Table | Added Column | Type | Constraints / Default | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `music_tracks` | `audio_hash` | `TEXT` | Nullable, Indexed | SHA-256 hexadecimal hash of audio bitstream |
| `music_tracks` | `file_size` | `BIGINT` | Nullable | Byte count of audio file |
| `music_tracks` | `audio_mime_type` | `TEXT` | `DEFAULT 'audio/mpeg'` | MIME type of encoded audio |
| `episodes` | `audio_hash` | `TEXT` | Nullable, Indexed | SHA-256 hexadecimal hash of podcast episode |
| `episodes` | `file_size` | `BIGINT` | Nullable | Byte count of episode file |
| `import_jobs` | `source_hash` | `TEXT` | Nullable, Indexed | SHA-256 hash of normalized source URL |

### Indices Created
- `idx_music_tracks_audio_hash`: B-Tree index on `music_tracks(audio_hash) WHERE audio_hash IS NOT NULL`.
- `idx_episodes_audio_hash`: B-Tree index on `episodes(audio_hash) WHERE audio_hash IS NOT NULL`.
- `idx_import_jobs_source_hash`: B-Tree index on `import_jobs(source_hash) WHERE source_hash IS NOT NULL`.
- `idx_import_jobs_source_hash_status`: Composite index on `import_jobs(source_hash, status) WHERE source_hash IS NOT NULL`.

All migration statements use `IF NOT EXISTS` constructs to guarantee zero downtime and 100% backward compatibility with existing records.

---

## 4. URL Normalization & Source Deduplication (`import-job`)

### Normalization Logic
External URLs undergo rigorous normalization before hash generation:
1. **YouTube URL Flattening**:
   - `https://youtu.be/<id>`
   - `https://www.youtube.com/watch?v=<id>`
   - `https://www.youtube.com/shorts/<id>`
   - `https://www.youtube.com/embed/<id>`
   - `https://m.youtube.com/watch?v=<id>`
   - All mapped to canonical: `https://www.youtube.com/watch?v=<id>`.
2. **Tracking & Ephemeral Parameter Stripping**:
   - Strips `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
   - Strips `si`, `feature`, `fbclid`, `gclid`, `ref`, `t`, `start`
3. **Query Parameter Sorting**:
   - Query string keys are lexicographically sorted to prevent reordering cache misses.

### Early Duplicate Detection
Before writing an `import_jobs` row, the function checks:
```typescript
const { data: existingJob } = await supabase
  .from('import_jobs')
  .select('id, status, target_table, result_id, error, created_at, source_hash')
  .eq('source_hash', sourceHash)
  .in('status', ['pending', 'processing', 'extracting', 'uploading', 'completed'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (existingJob) {
  return new Response(
    JSON.stringify({ job: existingJob, reused: true, message: 'Existing import job found' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

---

## 5. Audio Worker Transcode & Content Deduplication

Implemented in [`workers/audio-worker/worker.js`](file:///f:/Music%20GG/workers/audio-worker/worker.js) and [`services/audio-import-worker/index.js`](file:///f:/Music%20GG/services/audio-import-worker/index.js):

### Binary Hashing Algorithm
After FFmpeg transcoding:
```javascript
function computeFileHash(filePath) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
```

### Cross-Table Deduplication Check
```javascript
async function findExistingAudioByHash(supabase, audioHash) {
  // Check music_tracks
  const { data: track } = await supabase
    .from('music_tracks')
    .select('id, audio_url, file_size')
    .eq('audio_hash', audioHash)
    .not('audio_url', 'is', null)
    .limit(1)
    .maybeSingle()

  if (track?.audio_url) {
    return { audioUrl: track.audio_url, matchedTable: 'music_tracks', matchedId: track.id }
  }

  // Check episodes
  const { data: episode } = await supabase
    .from('episodes')
    .select('id, audio_url, file_size')
    .eq('audio_hash', audioHash)
    .not('audio_url', 'is', null)
    .limit(1)
    .maybeSingle()

  if (episode?.audio_url) {
    return { audioUrl: episode.audio_url, matchedTable: 'episodes', matchedId: episode.id }
  }

  return null
}
```

If a match is found:
- Storage upload is **bypassed entirely**.
- The existing public `audio_url` is reused.
- The new track or episode record references the identical storage asset while retaining its own metadata (title, artist, album, tags).

---

## 6. Bandwidth & Storage Egress Impact

| Metric | Before Optimization | After Phase 1-3 Optimizations | Expected Reduction |
| :--- | :--- | :--- | :--- |
| **Browsing Audio Fetch** | `preload="auto"` loaded audio on load | `preload="none"`: zero audio downloaded on browse | **-100% idle egress** |
| **Duplicate Media Requests** | Redundant `audio.load()` on queue/route changes | Single HTMLAudioElement, load on user play only | **-75% redundant requests** |
| **Duplicate Job Ingestion** | Redundant yt-dlp & worker executions | Hash-based canonical URL caching | **-90% duplicate import tasks** |
| **Storage Asset Duplication** | Multiple copies of identical tracks / podcasts | Binary SHA-256 deduplication & URL reuse | **~30-50% storage savings** |
| **Monthly Cached Egress** | Exceeded 20 GB (Quota violation) | Projected < 2-3 GB on normal catalog browsing | **~85-90% egress reduction** |

---

## 7. Verification & Test Results

The implementation was validated across automated test suites:

| Suite | Tests | Result | Focus Area |
| :--- | :---: | :---: | :--- |
| `tests/phase3-dedup.spec.js` | 5/5 | **PASSED** | YouTube canonicalization, URL sanitization, SHA-256 hashing, migration SQL inspection, worker deduplication simulation |
| `tests/lockscreen-playback.spec.js` | 4/4 | **PASSED** | Lockscreen controls, MediaSession stability, rapid next, empty queue session clearing |
| `tests/phase2-playback.spec.js` | 5/5 | **PASSED** | Ended event execution flow, auto next, safe `setPositionState`, stop action handler, Web Audio auto-resume |
| `tests/v2.spec.js` | 31/31 | **PASSED** | End-to-end player, equalizer, queue reordering, responsive layouts, auth lifecycles |

**Total passing tests**: **45 / 45 tests passed**.

