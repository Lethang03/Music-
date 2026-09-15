# SoundVerse feature upgrade

Implemented inside `F:\Music GG` on September 14, 2026. Production database migrations, Edge deployments and Netlify deployment remain pending. The existing Docker worker was rebuilt and started successfully. Existing user edits in `src/main.jsx` were preserved.

## 1. Podcast TikTok / YouTube import

### Architecture and schema audit

The checked-in schema defines `podcasts` and `episodes`, related by `episodes.podcast_id`. Episodes already have `title`, `description`, `audio_url`, integer `duration`, `episode_number`, `season_number`, `published`, `published_at` and `created_at`. Catalog queries order episodes by `published_at` descending with an ID tie-breaker; podcast detail retains its existing episode/season ordering. Episode artwork was absent from the baseline schema. This audit used the actual repository migrations and consuming code; the deployed production schema was not introspected or changed.

Admin → authenticated `import-job` Edge function → existing `import_jobs` table → existing atomic `claim_audio_import_job` RPC → Docker Node worker → yt-dlp metadata/audio → ffmpeg MP3 → Supabase Storage → one published `episodes` row → completed job. No independent podcast media queue or player was introduced. Existing RSS import remains available in its original tab.

### Admin UI

`AdminPodcastImport.jsx` offers RSS Feed and TikTok / YouTube tabs. `PodcastUrlImport.jsx` provides source detection, podcast selection, optional title/description, episode and season numbers, optional custom artwork URL, and an explicit permission checkbox. Unpublished podcasts cannot be selected because their episodes would remain hidden by existing parent-publication policies.

The durable queue polls every three seconds, survives revisiting the tab, offers cancel/retry, and refreshes the shared catalog when a job completes. It shows Pending, Extracting, Downloading, Converting, Uploading, Creating Episode, Completed, Failed or Cancelled. Intermediate names use `metadata.stage`, retaining existing database status values and stale recovery. Failed jobs show a safe message rather than extractor output.

### Database changes

New migration: `supabase/migrations/20260914000000_podcast_url_import.sql`.

- Adds `podcast_episode_url` to existing source types.
- Adds job target/result fields: `podcast_id`, `episode_id`, `source_platform`, `source_id`.
- Adds episode `cover_url`, `source_platform`, `source_id`, `source_url`, `source_author`, `import_job_id`.
- Adds unique episode indexes for import job ID and platform/source identity, plus an index preventing simultaneous active imports of a known source ID.
- Reconciles lyric columns and their existing mode/JSON-array constraints.
- Retains foreign keys, existing publication policies and existing claim/recovery RPC. Can be reapplied without deleting existing data.

### Edge and worker changes

`import-job/index.ts` retains bearer-token and admin-role checks; it validates supported video URLs, published podcast existence, permission confirmation and positive whole-number episode/season values. Known duplicate episodes return HTTP 409; duplicate queued sources also return a clear conflict. `audioImport.js` displays the function's JSON error message, including conflicts.

The Edge function has a local `podcastSource.js` validator so its deployment stays self-contained. The standalone Docker worker has the same validator, also imported by the frontend. Focused tests check parity between both copies.

`process-import/index.ts` returns podcast jobs to Pending if a legacy Edge polling invocation claims one, leaving extraction to Docker.

`workers/audio-worker/worker.js` reuses existing yt-dlp, ffmpeg, ffprobe, Supabase client, claim/cancel/retry and cleanup paths. It validates the resolved platform and video identity, extracts source metadata, preserves admin overrides, uploads a deterministic MP3 path and inserts one episode. An existing episode is reused on retry; database uniqueness also handles concurrent insert races.

Storage: bucket `soundverse`, path `audio/podcasts/<podcast_id>/<platform>-<source_id>.mp3`. The worker stores its public URL in `episodes.audio_url`. Title priority is admin title → source title → Imported Episode. Artwork priority is custom URL → source thumbnail → podcast artwork. `PodcastDetail.jsx` preserves episode artwork when constructing the existing playback queue.

Commands use `spawn(command, argumentArray)` without a shell. yt-dlp ignores external configuration and uses no playlist extraction; file-size limits apply. No cookies, account sessions, DRM/private-video/CAPTCHA bypass were added. Service-role credentials stay in the server environment. The new `.dockerignore` excludes `.env` and local dependencies from the worker image. Docker remains Node 22; local verification used Node 24.

### Tests and manual status

Focused tests cover YouTube canonical URL identity, normal/short TikTok URLs, unsafe/unsupported URLs, validator parity, admin metadata submission, duplicate conflict feedback, source and import-job uniqueness, stale claim recovery, and RSS/source coexistence.

Live new podcast import: **not run**. It requires deploying the new schema/function and choosing media the administrator is authorized to import. Browser submission tests use a mocked Supabase backend. An already queued Music URL job was observed reaching Completed after the worker rebuild; no new live Music job was submitted for this task.

Post-deployment manual check: import one owned YouTube video and one owned TikTok video into a published podcast; verify MP3 playback, title/artwork, season/episode fields and each progress stage. Re-submit alternate URL forms and retry an interrupted job; verify only one episode exists for each platform/source identity. Test unsupported/private media fails safely.

## 2. Music UI redesign

Files: `src/features/music/MusicLibrary.jsx`, new `MusicLibrary.css`, and `public/icons/icon.svg` placeholder artwork.

The page now has a navy hero with cyan/violet accents, track/artist counts and a subtle static music visualization. A bounded catalog layout replaces the floating wide controls. Search, sort and grid/list controls share one elevated toolbar; search has a visible icon and focus treatment. Collections include All music, the 20 most recent additions and Favorites. Existing genres remain available. Search uses title, artist and album; all collections support newest/title/artist sorting.

Cards show artwork, title, artist, album/single, duration, direct favorite control, existing action menu and a play affordance. The current track has an accent border and Now playing badge. Touch layouts expose play controls without hover. List mode keeps artwork/title/artist and actions on mobile while hiding album and duration columns. Desktop retains all columns.

Responsive columns: six at large desktop widths, five at wider desktop widths, four at normal desktop widths, three on tablet, two on mobile and one below 350 px. Grid columns and text use shrinkable widths. Loading skeletons, empty catalog, no-results/clear-filter and network-retry states are included. Additional bottom spacing accounts for the player, mobile navigation and safe area.

Screenshots (fixture data):

- `audit/music-grid-390.png`, `audit/music-grid-1280.png`
- `audit/music-library-390.png`, `audit/music-library-1280.png` (list)
- `audit/music-lyrics-390.png`, `audit/music-lyrics-1280.png`

## 3. Synced lyrics

### Schema and parser

The existing `20260910000000_synced_lyrics.sql` already defines `music_tracks.lyrics_type` and `synced_lyrics`. It was left unchanged. The new upgrade migration safely adds/reconciles these fields and constraints if necessary. Existing `lyrics` text stays intact.

`src/lib/lyrics.js` validates stored JSON, preserves numeric-string timestamp compatibility, parses LRC `mm:ss`, `mm:ss.xx` and `mm:ss.xxx`, supports multiple timestamps and offset metadata, skips malformed lines, sorts/deduplicates entries and infers end times. The final line ends at track duration or at least five seconds after its start. Active line selection uses a binary search with inclusive start and exclusive end.

### Admin editor

TrackForm → Advanced Details → Lyrics format → Synced lyrics → Paste LRC → Parse / Preview. Preview shows normalized timestamps/text. Admins can edit timestamps in LRC or the retained JSON editor, then use the existing Save content control. Updating LRC invalidates the old parsed payload until it is parsed again. Invalid/empty synced payloads cannot be saved. Plain lyrics are preserved when switching to synced mode.

### Player integration and scrolling

`GlobalPlayer.jsx` passes the existing `currentTime` and `seek` to `SyncedLyrics.jsx`; no lyric-owned Audio object or clock exists. Lyrics resolve from the current catalog by song ID, with the active item as fallback, so restored queues, favorites and history snapshots do not keep stale lyrics. Valid synced lyrics take priority; otherwise existing plain text is displayed, then Lyrics unavailable. A song-ID key remounts lyric state for a different song, removing previous lines and resetting follow state.

The active line turns white with a modest size/accent change; past lines fade. The local lyric container scrolls smoothly only on active-index or follow-state changes, without scrolling the whole page. Wheel, touch, pointer/scrollbar and keyboard interactions suspend following for five seconds; Follow Lyrics resumes immediately. Clicking a line uses existing player seek. Reduced-motion preferences disable smooth scrolling. On tablet/mobile, opening lyrics uses a compact presentation of the existing controls and a visible scrollable lyric panel.

JSON parsing is memoized, active selection is logarithmic and line refs avoid repeated DOM searches. Playback time comes solely from existing media events. A small provider lifecycle correction retains the stopped audio instance across effect restarts/React StrictMode, with all listeners and sources still cleared on cleanup. Queue, Media Session, background playback and podcast playback architecture remain intact.

## 4. Verification

| Check | Result |
| --- | --- |
| `npm run build` | PASS; Vite reports the existing main bundle size warning |
| `npm run lint` | PASS |
| `npx playwright test tests/v2.spec.js --workers=1 --reporter=list` | PASS, 31/31 |
| `npx playwright test tests/feature-upgrade.spec.js --workers=1 --reporter=list` | PASS, 14/14 |
| Combined regression + feature run before the final restored-queue test was added | PASS, 44/44 |
| `node audit/check-database.mjs` | PASS, 36 checks |
| `node audit/check-feature-upgrade.mjs` | PASS, 6 checks |
| `node --check workers/audio-worker/worker.js` | PASS |
| Docker rebuild/start | PASS |

Docker container: `audio-worker-audio-worker-1`, status Up. Startup messages were verified: `Audio worker started; polling every 3000ms.` and `Health: OK. Ready to process jobs.`

Browser QA covers Music grid/list/search controls and scrollable, visible lyrics at 375×667, 390×844, 430×932, 360×800, 412×915, 768×1024, 1280×800 and 1920×1080. No document horizontal overflow was found. Focused checks verify icon/input alignment, active lyrics above the bottom player/navigation, lyric seek, follow reset, plain fallback and one playable media instance. The regression suite covers favorites/history/playlist/queue playback, natural endings, repeat/shuffle, podcast resume, authentication and mobile views. Existing test files were not edited.

Physical iPhone background playback and native soft-keyboard behavior were not tested on a device. Browser fixtures establish UI and playback regressions, not live platform extraction.

Vite now excludes generated browser profiles and reports from file watching; Windows Chrome locks otherwise caused EBUSY during initial tests. The non-admin notice wording was aligned with the existing regression expectation. Initial sandbox restrictions required approved build/browser/Docker execution and writing the database audit result.

## 5. Deployment steps

Run these from PowerShell with Node/npm available. CLI login/linking requires the existing account credentials. Do not place service-role keys in frontend variables.

```powershell
Set-Location 'F:\Music GG'
npx supabase login
npx supabase link --project-ref ywfwsklpmoogvfscjrja
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase functions deploy import-job --project-ref ywfwsklpmoogvfscjrja
npx supabase functions deploy process-import --project-ref ywfwsklpmoogvfscjrja
npm run build
npx netlify login
npx netlify link
npx netlify deploy --prod --dir=dist
Set-Location 'F:\Music GG\workers\audio-worker'
docker compose up -d --build
docker ps --filter name=audio-worker-audio-worker-1
docker logs --tail 20 audio-worker-audio-worker-1
```

Review the dry-run migration list before pushing. Older unapplied repository migrations, including the original lyric migration, must be applied in order. Keep the existing `soundverse` Storage bucket and server-side worker environment. The worker rebuild was already verified locally; run it again on the deployment host after schema/Edge deployment. No destructive production database operation, production migration push, Edge deployment or Netlify publication was performed by this task.
