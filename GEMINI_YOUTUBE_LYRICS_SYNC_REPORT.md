# SoundVerse: Gemini & YouTube Automated Lyrics Synchronization System

## 1. Architecture Overview

SoundVerse now features an automated, production-grade system that upgrades tracks with plain lyrics into time-synced lyrics (`synced_lyrics` and standard `.lrc`) using authorized YouTube sources as audio/timing references analyzed by Google Gemini.

```
                              SoundVerse Client
     ┌──────────────────────────────────────────────────────────────┐
     │ Admin Music Track Editor / Batch Lyrics Synchronization Tool │
     └───────────────┬───────────────────────────────┬──────────────┘
                     │                               │
        (1) Direct Alignment Request      (2) Batch Runner Queue
                     │                     (Concurrency 1-2)
                     ▼                               ▼
     ┌──────────────────────────────────────────────────────────────┐
     │               src/lib/geminiLyricsSync.js                    │
     │ - Discover YouTube Source (track/metadata/import_jobs)       │
     │ - Quality Metrics & Duration Drift Evaluation                │
     │ - Safe In-Editor Audio Preview (timeupdate seek)             │
     └───────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
     ┌──────────────────────────────────────────────────────────────┐
     │        Supabase Edge Function: align-lyrics/index.ts         │
     │ - Server-side authentication (Bearer token)                  │
     │ - Admin authorization check (app_metadata / profile role)    │
     │ - Strict YouTube URL canonicalization                        │
     │ - Server-side GEMINI_API_KEY (never exposed to client)       │
     └───────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
     ┌──────────────────────────────────────────────────────────────┐
     │              Google Gemini Generative API                    │
     │ - Input: YouTube audio fileUri + Canonical lyric lines       │
     │ - Output: Strict Structured JSON schema                      │
     │   [{ line_index, text, start, end, confidence }]             │
     └───────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
     ┌──────────────────────────────────────────────────────────────┐
     │           src/lib/lyrics.js Alignment & Validation           │
     │ - Monotonicity constraint (start >= prev.start)              │
     │ - Omitted end inference (current.end = next.start)           │
     │ - Final line fallback against track duration                 │
     │ - Canonical text preservation (original spelling/quotes)     │
     │ - Confidence scoring (High >= 0.85, Med >= 0.60, Low < 0.60) │
     └───────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
     ┌──────────────────────────────────────────────────────────────┐
     │               Database: public.music_tracks                  │
     │ - lyrics (canonical plain text PRESERVED)                    │
     │ - lyrics_type = 'synced'                                     │
     │ - synced_lyrics = [{ start, end, text }]                     │
     │ - source_url, lyrics_sync_source_url                         │
     │ - lyrics_sync_confidence, lyrics_synced_at                   │
     └──────────────────────────────────────────────────────────────┘
```

---

## 2. Gemini Integration & Security

- **Server-Side Credential Isolation**: The Gemini API key (`GEMINI_API_KEY`) is stored exclusively in server environment variables (Deno Edge Function runtime). Client-side code never receives or stores API secrets.
- **Admin Authorization**: Edge Function calls require an authenticated session and verify `admin` privileges before dispatching requests to Gemini.
- **Multimodal Video Understanding**: Passes the normalized YouTube URL via `fileData: { fileUri: source_url }` alongside a structured prompt with line-numbered canonical lyrics.
- **Strict Structured JSON Schema**: Gemini is constrained to return a JSON array matching:
  ```json
  {
    "type": "ARRAY",
    "items": {
      "type": "OBJECT",
      "properties": {
        "line_index": { "type": "INTEGER" },
        "text": { "type": "STRING" },
        "start": { "type": "NUMBER" },
        "end": { "type": "NUMBER" },
        "confidence": { "type": "NUMBER" }
      },
      "required": ["line_index", "text", "start", "end", "confidence"]
    }
  }
  ```
- **Failure Resilience**: If Gemini encounters a rate limit, timeout, or parsing anomaly, errors are safely reported back as structured error messages (`status: 'failed'`). Stored plain lyrics are never overwritten or corrupted on failure.

---

## 3. YouTube Source Handling & Discovery

- **Source Resolution Order**:
  1. `music_tracks.lyrics_sync_source_url` or `music_tracks.source_url`.
  2. Linked `import_jobs` table lookup if the track was previously imported via the Audio Worker (`import_job_id`).
  3. Manual entry by the Administrator in the Admin Track Form.
- **Strict Hostname & Format Validation**:
  Validated using `validateYouTubeUrl()` (supporting `youtube.com/watch?v=...`, `youtu.be/...`, and `youtube.com/shorts/...`). Arbitrary or private network URLs are rejected.
- **Version Safety & Duration Guard**:
  Before synchronization, the system compares the audio track's duration against the YouTube source duration. If the difference exceeds 5 seconds, a prominent warning is shown:
  > *⚠️ Warning: Source duration differs from track duration. Source may be a different song version.*

---

## 4. Canonical Lyrics Preservation & Alignment Algorithm

- **Canonical Text Guarantee**: The plain `lyrics` stored in `music_tracks` is the single source of truth. Gemini's response is used purely for timestamps (`start`, `end`) and confidence scoring. The final synchronized output always matches the canonical text character-for-character.
- **Timestamp Validation Rules**:
  - `start >= 0` and finite.
  - Monotonically increasing timestamps (`start[i] >= start[i-1]`).
  - Strict `end > start`.
  - **Omitted End Inference**: If an `end` timestamp is omitted or invalid, `end` is inferred as `next.start`.
  - **Final Line Fallback**: The last lyric line uses the track's total duration when available, or defaults to `start + 5`.
  - **Overlap Resolution**: Clamps line ends if they exceed the subsequent line's start.

---

## 5. Quality Metrics & Confidence Review

The alignment engine computes comprehensive quality indicators:
- **Original Lines**: Total line count in canonical plain lyrics.
- **Aligned Lines**: Lines matched with valid timestamps.
- **Unmatched Lines**: Discrepancies between original and returned lines.
- **Confidence Scoring**:
  - **High** ($\ge 0.85$): Green badge.
  - **Medium** ($0.60 - 0.84$): Amber badge.
  - **Low** ($< 0.60$): Red badge, flagged as suspicious.
- **Overall Status**:
  - `success`: 100% matched, high average confidence, no duration mismatch.
  - `needs_review`: Low-confidence lines present or duration drift detected.
  - `failed`: > 40% unmatched or severe parsing failure.

---

## 6. LRC Formatting & Database Schema

- Standard LRC timestamps are formatted as `[mm:ss.xx]Text` using `toLrc()` from `src/lib/lyrics.js`.
- Saved format complies with SoundVerse schema:
  - `lyrics_type = 'synced'`
  - `synced_lyrics = [{ "start": 12.42, "end": 16.10, "text": "..." }]`
  - `lyrics`: original plain lyrics preserved intact.
  - `lyrics_sync_confidence`: average confidence score.
  - `lyrics_synced_at`: ISO timestamp of synchronization.
  - `lyrics_sync_source_url`: YouTube reference URL.

---

## 7. Admin UI & Interactive Player Preview

### Single Track Synchronization (`TrackForm.jsx`)
1. **Source Discovery**: Displays detected YouTube source URL with a "Detected from media" badge, or allows manual entry.
2. **Auto Sync with YouTube Button**: Triggers step-by-step progress:
   - Step 1: Source detected
   - Step 2: Analyzing timing with Gemini
   - Step 3: Alignment complete
   - Step 4: Preview
3. **Line-by-Line Preview**: Displays timestamped lines with confidence badges.
4. **Interactive Seek**: Clicking any line seeks the audio element directly to that timestamp.
5. **Real Player Integration**: Highlights the active line in real time as the preview audio plays.
6. **Actions**:
   - `[ Play Preview ]` / `[ Pause Preview ]`
   - `[ Re-run Sync ]`
   - `[ Edit LRC ]` (in-line editor for manual timestamp tweaks)
   - `[ Save Synced Lyrics ]` (updates form state and sets `lyrics_type = 'synced'`)

### Batch Synchronization (`BatchLyricsSyncModal.jsx` & `AdminMusic.jsx`)
1. **Toolbar Button**: `⚡ Auto Sync Existing Lyrics` in Admin Music dashboard.
2. **Eligibility Filtering**: Automatically counts and filters tracks having plain lyrics but no synced lyrics.
3. **Concurrency Control**: Throttled to 1–2 tracks at a time to prevent API rate limits.
4. **Queue Management**: Supports `Start`, `Pause`, `Resume`, and `Retry Failed`.
5. **Real-time Status**: Shows per-track status (`Queued`, `Analyzing...`, `Completed`, `Needs Review`, `Failed`) with live progress bar.

---

## 8. Mobile & Playback Architecture Compatibility

- **Zero Additional Audio Elements**: Reuses existing audio elements and does not spawn conflicting background `Audio()` instances.
- **Follow Lyrics & Auto-Scroll**: Output conforms to `SyncedLyrics.jsx` expectations, ensuring seamless line highlighting and auto-scroll on desktop, iOS Safari, and Android Chrome.

---

## 9. Files Changed & Created

| File | Type | Description |
| :--- | :--- | :--- |
| `supabase/migrations/20260914010000_lyrics_sync_metadata.sql` | NEW | Migration adding `source_url`, `source_platform`, `source_id`, `lyrics_sync_confidence`, `lyrics_synced_at`, `lyrics_sync_source_url`. |
| `supabase/functions/align-lyrics/index.ts` | NEW | Edge Function handling admin authentication, YouTube validation, and Gemini API structured timing extraction. |
| `supabase/functions/align-lyrics/podcastSource.js` | NEW | Edge Function URL validator mirror for YouTube source URLs. |
| `src/lib/lyrics.js` | MODIFIED | Added `splitLyricsToLines`, `validateAndAlignTimestamps`, and `calculateSyncQuality`. |
| `src/lib/geminiLyricsSync.js` | NEW | Source discovery, Edge Function invocation, and `BatchLyricsSyncRunner`. |
| `src/lib/supabase.js` | MODIFIED | Safe environment variable initialization across Vite and Node/Playwright. |
| `src/features/admin/components/TrackForm.jsx` | MODIFIED | Integrated Auto Sync with YouTube, step indicators, line confidence badges, and interactive audio preview. |
| `src/features/admin/components/TrackForm.css` | MODIFIED | Added CSS for lyrics sync card, step indicator, line preview, and confidence badges. |
| `src/features/admin/components/AdminMusic.jsx` | MODIFIED | Added "Auto Sync Existing Lyrics" button and `BatchLyricsSyncModal` integration. |
| `src/features/admin/components/BatchLyricsSyncModal.jsx` | NEW | Batch synchronization modal with concurrency controls, status list, and pause/resume. |
| `src/features/admin/components/BatchLyricsSyncModal.css` | NEW | Modal styles, progress bar, counters, and status badges. |
| `tests/fixtures.js` | MODIFIED | Added mock route for `/functions/v1/align-lyrics` and `import_jobs` table support. |
| `tests/gemini-lyrics-sync.spec.js` | NEW | 8 comprehensive tests for canonical preservation, timestamp rules, URL validation, batch mode, and player integration. |

---

## 10. Verification & Test Results

### 1. Database Migrations (`npm run test:db`)
```
PASS full migration sequence bootstraps an empty public schema
...
PASS migration applies: 20260914010000_lyrics_sync_metadata.sql
37 database checks passed
```

### 2. Linting (`npm run lint`)
```
eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
0 warnings, 0 errors
```

### 3. Production Build (`npm run build`)
```
✓ 1499 modules transformed.
dist/index.html                           0.94 kB
dist/assets/AdminPage-BkDTGW6I.js        88.51 kB
dist/assets/index-8Pp-vlo7.js           512.01 kB
✓ built in 3.02s
```

### 4. Focused Lyrics Synchronization Suite (`tests/gemini-lyrics-sync.spec.js`)
```
Running 8 tests using 1 worker
  ok 1 canonical lyric preservation: exact text, spelling, and order are preserved
  ok 2 timestamp validation: monotonic, end > start, omitted ends inferred, final line fallback
  ok 3 quality calculation: detects duration mismatch, low confidence, and unmatched lines
  ok 4 YouTube URL validation: accepts valid formats and rejects non-YouTube URLs
  ok 5 BatchLyricsSyncRunner: manages queue, concurrency, skipping, pause and resume
  ok 6 Admin UI: Auto Sync with YouTube workflow: detects source, aligns, previews confidence and saves
  ok 7 Admin UI: batch modal opens, shows eligible count, controls, and runs
  ok 8 Player integration: synchronized song highlights active lyric and supports seek
8 passed (8.3s)
```

### 5. Existing Feature Upgrade Suite (`tests/feature-upgrade.spec.js`)
```
Running 14 tests using 1 worker
  14 passed (35.5s)
```

### 6. Existing Core v2 Regression Suite (`tests/v2.spec.js`)
```
Running 31 tests using 1 worker
  31 passed (2.5m)
```

---

## 11. Known Limitations & Best Practices

1. **Content Rights**: This feature is designed for tracks that you own, control, or have explicit permission to process.
2. **Source Version Consistency**: If a track has an extended intro in the official music video (e.g., narrative MV dialogue), the timestamps will reflect the MV timeline. Administrators should review lines flagged as Medium/Low confidence or use the audio preview seek to verify timing.
3. **Instrumental Gaps**: For long instrumental breaks, Gemini identifies silence and advances timestamps to the next vocal entry; administrators can edit timestamps in the built-in LRC editor before saving.

