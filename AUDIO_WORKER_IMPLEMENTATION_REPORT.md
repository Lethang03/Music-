# Audio Worker Implementation Report

## Delivered architecture

`Admin Import Queue` now stages an optional local file, then calls the
`import-job` Edge Function to create, retry, cancel, or delete a job. The Edge
Function is limited to authentication, admin authorization, input validation,
and queue mutation. It performs no media fetching, extraction, or conversion.

The new deployable service is at `workers/audio-import-worker`. It atomically
claims pending jobs via `claim_audio_import_job()`, then runs the media workload
in its container:

1. Download a direct URL or staged Storage upload, or obtain source metadata
   and audio through `yt-dlp` for a video URL.
2. Normalize audio with `ffmpeg` to a 192 kbps, 44.1 kHz stereo MP3.
3. Upload the MP3 to `soundverse/audio/imports/...`.
4. Insert a published row in `music_tracks` (the project's tracks table).
5. Link the job to the row and complete it.

The worker emits structured JSON logs with `job_id`, `source_url`, `step`, and
an `error` field on failures. Docker includes both `ffmpeg` and `yt-dlp`.

## Job states

`pending → processing → extracting → uploading → completed`

Failures transition to `failed`; administrator cancellation remains supported
as the separate terminal `cancelled` state. Migration
`20260908000007_audio_import_extracting_state.sql` adds `extracting` to the
database constraint. The queue shows the new state and no longer performs any
browser-side extraction, download, conversion, storage upload, or track insert.

## Deployment and verification

1. Apply all migrations, including `20260908000007_audio_import_extracting_state.sql`.
2. Deploy `supabase/functions/import-job`.
3. Build and run `workers/audio-import-worker` with the environment values in
   its `.env.example`. The service-role key belongs only in the worker runtime.
4. In Admin → Import Music, submit a permitted YouTube URL. Observe the queue
   transition through the states above; container logs identify the job and step.
5. Confirm a completed job has an `audio/imports/*.mp3` object in the
   `soundverse` bucket and a linked `music_tracks` row. Refresh Music Library
   and play that row to confirm the public MP3 URL is playable.

This repository change has been syntax/build checked. A live YouTube ingestion
cannot be executed here because it needs deployed Supabase credentials, a
running container worker, and authorized network access to YouTube.
