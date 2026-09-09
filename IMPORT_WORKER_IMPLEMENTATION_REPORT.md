# Import Worker Implementation Report

## Delivered

- Replaced the generated `process-import` placeholder with an authenticated Supabase Edge worker.
- `import-job` now dispatches the worker after a job is created or retried. The dispatch is retained with `EdgeRuntime.waitUntil`, so the queue request returns promptly.
- The worker atomically claims exactly one pending job through `claim_audio_import_job()`. The database function uses `FOR UPDATE SKIP LOCKED`, preventing concurrent worker invocations from processing the same job.
- Job transitions are `pending -> processing -> extracting -> uploading -> completed`; errors result in `failed` with a saved, capped `error_message`. Cancellation is respected between stages.
- Staged Storage uploads and public HTTP(S) audio URLs are copied into the `soundverse` Storage bucket, then written to `music_tracks`.
- Direct URL redirects are validated hop-by-hop and private-network destinations are rejected. Imports are capped at 500 MB.
- Structured worker logs include the job ID, source type, event, byte count (for uploads), failure reason, and completed track ID.
- Failed jobs can be retried using the existing retry action. A new `music_tracks.import_job_id` unique key makes the track insert idempotent when a worker is retried after its Storage upload succeeds.

## Deployed

Applied migration:

`20260909000000_import_worker_idempotency.sql`

Deployed and verified active:

- `process-import` (version 1)
- `import-job` (version 3)

## Smoke Test

Create an import from the admin Music Import screen while signed in as an administrator.

Expected queue progression:

`Pending -> Preparing -> Extracting audio -> Uploading -> Completed`

On a bad/unreachable/non-audio source, the terminal state is `Failed`, with the failure reason visible in the queue. It will not remain `Pending` because `import-job` now dispatches the worker immediately.

## Operational Notes

- The `soundverse` Storage bucket must remain available and public, as track URLs are obtained with `getPublicUrl`.
- This Edge worker handles staged audio files and direct audio URLs. Video-source extraction requires the existing non-Edge `audio-import-worker` service (which has `yt-dlp` and `ffmpeg`); an attempted video import in the Edge worker fails clearly rather than becoming stuck.
- A live job was not created during this implementation because that operation requires an authenticated administrator session. Deployment and database migration were verified against the linked Supabase project.
