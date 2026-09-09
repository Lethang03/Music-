# YouTube Import Workflow Fix Report

## Result

The `import-job` Edge Function now only authenticates, validates, and creates
queue records. A video/YouTube submission creates an `import_jobs` row with:

- `source_url`: submitted URL
- `source_type`: `video`
- `status`: `pending`
- `created_by`: authenticated administrator ID

It no longer invokes the `process-import` Edge Function. That invocation was
the cause of the immediate failure because it atomically claimed the video job
and then raised: `Video imports require the external audio extraction worker
and cannot run in the Edge worker.`

## Worker flow

`workers/audio-worker/worker.js` uses the Supabase service-role connection and
the `claim_audio_import_job()` RPC. The RPC uses `FOR UPDATE SKIP LOCKED` and
atomically changes an eligible job from `pending` to `processing`.

For video jobs, the Node worker runs bundled `yt-dlp`, converts the extracted
audio to MP3 with ffmpeg, uploads it to the `soundverse` Storage bucket,
inserts an idempotent `music_tracks` record, and marks the job `completed`.

Worker console events now include the requested lifecycle messages:

`Found job` -> `Processing URL` -> `Extracting audio` -> `Uploading` ->
`Completed`

## Validation

- `node --check workers/audio-worker/worker.js`: passed.
- `npm.cmd run build`: passed.
- The worker starts with `npm.cmd run worker` from the project root (a root
  `worker` script was added).
- The local worker could not complete a live Supabase poll because this
  execution environment returned `fetch failed`; no test import was created.

## Deployment

The updated function was deployed successfully with:

```powershell
npx --yes supabase functions deploy import-job
```

Supabase confirmed deployment of `import-job` to project
`ywfwsklpmoogvfscjrja`.

After deployment, start the external worker from the repository root with
`npm.cmd run worker`, then create a new YouTube import. The job should remain
pending until claimed by the worker, progress through processing/extracting/
uploading, and finish completed without the Edge-worker video error.
