# Production readiness handoff

## Implemented

- Preserved the existing podcast mobile flow; no podcast mobile components or styles were changed.
- Completed the protected import pipeline: URL/video jobs are validated by the `import-job` Edge Function, claimed atomically, converted to MP3, uploaded to the public `soundverse` Storage bucket, and create one idempotent `music_tracks` row.
- Removed the insecure browser-to-table fallback for import jobs. An unavailable Edge Function now returns a visible error instead of allowing a private-network URL to reach the worker.
- Added recovery for jobs stranded by a worker/host restart. A worker atomically reclaims in-progress jobs only after one hour and records a retry.
- Hardened the worker container with system `ffmpeg` and `ffprobe`; added `docker-compose.yml`, restart policy, read-only filesystem, and a tmpfs work area for 24/7 hosting.
- Fixed the auth signup trigger so it no longer writes a nonexistent `profiles.email` column.
- Revoked client permission to update `profiles.role`, preventing self-promotion to admin.

## Deployment steps still required

This workspace has no Docker installation or configured hosted-container target, so a 24/7 worker cannot be launched from here. Apply migrations and deploy the Edge Function, then deploy `workers/audio-worker` to any always-on Docker host (Render, Railway, Fly.io, ECS, VM, etc.):

```sh
cd workers/audio-worker
cp .env.example .env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the host's secret manager.
docker compose up -d --build
```

The service must use the `workers/audio-worker` directory as its Docker build root. Do not put the service-role key in browser variables or source control.

## Storage/RLS contract

The existing `soundverse` public bucket is used for audio, artwork, admin uploads, and staged imports. Migration `20260908000004_admin_storage_and_roles.sql` creates the bucket, grants public read, and restricts object management to admins. The worker uses the service-role key for its server-side writes.

## Verification

- `npm.cmd run test:db`: **33/33 passed** after applying the full migration sequence, including import claim/reclaim, Storage policy bootstrap, signup, RLS, and role-escalation checks.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.
- `node --check workers/audio-worker/worker.js`: passed.
- Full Playwright regression was started. The first eight tests, including both protected mobile podcast tests, passed. The local machine has multiple pre-existing Node/Playwright processes and no Docker executable; the run subsequently showed timing failures in natural-ending tests while concurrent workers were active. Re-run from a clean process session before release:

```sh
npm.cmd run test:e2e
```

## Release gate

Do not claim the worker is 24/7 deployed until the migrations and Edge Function are applied and the compose service is running on an always-on host. The application build, lint, database security checks, and worker syntax checks are ready.
