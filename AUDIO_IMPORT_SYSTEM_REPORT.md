# Audio Import System Report

## Delivered architecture

The React admin page only stages a selected local file and creates a job. All URL/video retrieval, metadata extraction, MP3 conversion, final storage upload, and `music_tracks` insertion are performed by the separately deployable `audio-import-worker` service.

`Admin Import` → `import-job` Edge Function (admin/URL validation) → `import_jobs` queue → worker (yt-dlp/FFmpeg/ffprobe) → `soundverse` Storage → `music_tracks` → existing library and player.

Three UI tabs are included: Upload File, Import URL, and Import Source (video/audio source). The queue persists across page refreshes and displays status, percentage, readable errors, retry, cancel, and delete actions.

## Backend and database changes

- `supabase/migrations/20260908000006_audio_import_jobs.sql` creates `import_jobs`, RLS policies, queue indexes, and an atomic `claim_audio_import_job()` function. Job states are `pending`, `processing`, `uploading`, `completed`, `failed`, and `cancelled`.
- `supabase/functions/import-job/index.ts` authenticates administrators, blocks non-HTTP(S) and private-network URLs, validates staged uploads, and performs job lifecycle actions.
- `services/audio-import-worker/` is a Dockerized Node worker. It uses `yt-dlp` for supported video/audio sources, FFmpeg for MP3 normalization, ffprobe for duration, Supabase Storage for artifacts, and creates published `music_tracks` with extracted title, artist, album, genre, cover, audio URL, and duration.
- Uploads are staged under `soundverse/imports/<admin-id>/`; the worker publishes normalized audio under `audio/imports/` and covers under `covers/imports/`.

## Files changed

- `src/features/admin/components/AdminMusicImport.jsx`
- `src/lib/audioImport.js`
- `supabase/migrations/20260908000006_audio_import_jobs.sql`
- `supabase/functions/import-job/index.ts`
- `services/audio-import-worker/{Dockerfile,index.js,package.json,.env.example}`

## Deployment required

Apply migrations, deploy the `import-job` Edge Function, then deploy the worker image with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured from `.env.example`. The worker image includes FFmpeg and yt-dlp. Do not expose the service-role key to the browser.

## Verification results

- Production frontend build: passed.
- ESLint: passed.
- Import worker JavaScript syntax: passed.
- Git diff whitespace check could not run because the pre-existing `.git/index` is corrupted (`index file smaller than expected`); no repository repair was attempted.
- Live import/database/storage/player/mobile/auto-next verification cannot be run locally because no Supabase project, deployed Edge Function, worker credentials, or authorized source URL are available in this workspace.

## Limitations and operational notes

- Video extraction depends on the source being supported by the deployed yt-dlp version and on the administrator having rights to import the content.
- The default source/file limit is 500 MB; set `MAX_IMPORT_BYTES` in the worker environment to adjust it.
- Cancellation is cooperative: a running FFmpeg/yt-dlp process completes its current command but is prevented from publishing the job as completed after cancellation.
- Staged source uploads are intentionally retained on failure for investigation; configure a Storage lifecycle policy or a scheduled cleanup for old `imports/` objects.
