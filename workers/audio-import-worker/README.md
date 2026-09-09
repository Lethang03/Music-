# Audio import worker

Long-running import processor for Soundverse. It is deliberately separate from
Supabase Edge Functions because `yt-dlp`, `ffmpeg`, temporary files, and source
downloads need a normal container runtime.

## Deploy

1. Create a private environment from `.env.example`; never expose the service-role key to the browser.
2. Build and run the included Dockerfile on a worker/container platform.
3. Apply the Supabase migrations, including `20260908000007_audio_import_extracting_state.sql`.
4. Keep one or more replicas running. `claim_audio_import_job()` uses `FOR UPDATE SKIP LOCKED`, so each pending job is claimed by only one replica.

The container requires outbound access to permitted source sites, Supabase, and any media CDN selected by `yt-dlp`.
