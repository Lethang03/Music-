# Audio worker final report

## Delivered

Created the standalone Node.js queue worker at `workers/audio-worker`.

- `worker.js` loads environment variables with `dotenv`, polls the `import_jobs` queue, and claims jobs through the existing atomic `claim_audio_import_job()` RPC.
- A claimed job moves from `pending` to `processing`; YouTube/video jobs then move through `extracting` and `uploading` before `completed`.
- The worker runs `yt-dlp` to retrieve audio, normalizes it to a 192 kbps MP3 using FFmpeg, uploads it to the `soundverse` bucket, and creates a `music_tracks` record.
- Extraction, conversion, upload, database, and process-start errors mark the job `failed` with the real (trimmed) error message. Cancellation is preserved.
- The existing `import-job` Edge Function is unchanged. It continues to create/retry/cancel jobs; this worker only consumes them.
- `import_job_id` is used for idempotency and relies on the existing migration `20260909000000_import_worker_idempotency.sql`.

## Run

1. Ensure the repository migrations, including `20260909000000_import_worker_idempotency.sql`, are applied to Supabase.
2. Install worker dependencies:
   `cd workers/audio-worker && npm install`
3. Copy `.env.example` to `.env` and set the Supabase service-role credentials.
4. The Node package uses `yt-dlp-exec` (the maintained Node wrapper for yt-dlp) and `ffmpeg-static`; install `yt-dlp` and `ffprobe` as executable binaries on the worker host, or configure `YT_DLP_BIN` and `FFPROBE_BIN`. Configure `FFMPEG_BIN` too if you prefer a host FFmpeg binary.
5. Start the worker: `npm run worker`.

## Verification procedure

Create a video import job in Admin Import and refresh the queue. Observe:

`pending` -> `processing` -> `extracting` -> `uploading` -> `completed`.

Then confirm the `soundverse` bucket has `audio/imports/<job-id>-*.mp3`, the job has a `track_id`, the matching `music_tracks` row has an `audio_url`, and play that track in the Music Library. A live YouTube extraction was not run here because it needs valid Supabase service-role credentials plus worker-host binaries/network access.
