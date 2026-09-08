# Final audit — SoundVerse

Date: 2026-09-08. Workspace: `E:\Music GG`.

## Release status

Application fixes are implemented and locally validated. **The live service is not yet production-ready:** its database still needs the supplied migrations. Only a public browser key is configured; no privileged SQL connection or authenticated test accounts were available. No live database writes were performed.

This report supersedes readiness claims in earlier reports. Local browser tests use a simulated Supabase API and real HTMLAudioElement playback; SQL tests run PostgreSQL through PGlite. Neither substitutes for testing the deployed database with two real accounts.

## Verified live findings

Read-only requests used the configured public key, without a user session. The probe printed column names and counts, not profile values or secrets.

| Area | Observation | Resolution |
| --- | --- | --- |
| Profiles | A row was returned anonymously. The table has `id`, `display_name`, `avatar_url`, `bio`, `role`, `created_at`; no `email`. | Owner/admin read restrictions and editable-column grants are supplied. Client recovery no longer writes email. |
| Activity | `404 / PGRST205`: `public.soundverse_activity` missing from schema cache. | Corrected migration sequence creates the activity table and reloads PostgREST schema. |
| Music, podcasts, episodes | Tables and expected core columns are reachable. | Existing catalog queries retained; paged reads and browse indexes added. |
| Playlists, legacy favorites | Tables reachable, no rows returned by the limited anonymous probe. | Playlist ownership policies retained; optional legacy owner guards added. Empty results alone do not prove security. |
| History, playlist_tracks, settings | Tables absent. | Current application does not query these: activity contains history/favorites, playlists contain `track_ids`, settings use browser storage. No unnecessary duplicate tables created. |

## Bugs and implemented fixes

1. **Profile recovery silently failed.** The client upsert included an absent/non-editable email column, did not inspect write errors, and ended its loading state before recovery finished. It now awaits recovery and the final read, uses editable fields only, preserves concurrently created profiles, and exposes a working Retry profile button. Requests have cancellation and timeouts. Profiles are masked when their ID differs from the current account.
2. **Registration trigger used the wrong schema.** It inserted email into profiles and had an unrestricted search path. The corrected definer function uses a pinned empty search path, creates only ID/display name, ignores existing rows, and backfills missing profiles without overwriting them. Client metadata never grants administrator status.
3. **Migration chain could not run.** Two migrations independently created activity. The second now extends the first. A baseline creates missing core tables; policy/trigger installation is repeatable. Both empty-schema installation and reapplication are tested.
4. **Logout recreated cleared player storage.** Pause/unmount handlers persisted the old queue after storage removal. Logout now stops/releases audio, clears the player model, invalidates pending playback promises, and suppresses subsequent persistence. Account changes clear private catalog/activity caches. A best-effort activity flush runs before logout; after successful logout the browser activity cache is removed.
5. **Now Playing crashed.** The overlay referenced an undefined `dialogRef`. Its ref and focus-trap hook are now initialized.
6. **Pending resume offsets could be overwritten.** Player persistence preserves the pending seek until metadata loads; progress reporting ignores unloaded audio. The audio fixture now supports HTTP byte ranges, and the test verifies seeking before and after refresh.
7. **Mixed activity batches could violate database defaults.** Cloud-loaded rows contained server fields that newly created rows did not. Sync now sends a uniform writable payload, omitting server defaults. Dirty-row acknowledgement compares snapshots, so an update made during a request stays dirty. Callers can await an in-flight sync.
8. **Catalog/history responses were silently capped.** Reads now request 500-row pages with deterministic ordering. A browser regression test finds a track beyond row 1,000. Superseded catalog requests and unmounted activity reads are aborted; cancellation retains the fetch timeout.
9. **Service worker intercepted development requests and had an incomplete offline cache.** Registration runs only in production. The worker handles same-origin navigation failures with a standalone offline page, leaves API/audio/range requests to the network, and deletes only old SoundVerse caches. The previously referenced 192/512px icons now exist, with an editable SVG source.
10. **Dependency vulnerabilities.** Updated Vite to 6.4.3 and React Router DOM to 7.18.3. npm's installation audit reported zero vulnerabilities, down from four (one high, three moderate).
11. **Mobile zoom disabled.** Removed viewport restrictions that prevented zoom. Updated the document title to SoundVerse.

## Database changes

Apply the files in this order through a privileged Supabase SQL connection or SQL Editor:

1. `supabase/migrations/20260906000000_baseline.sql`
2. `supabase/migrations/20260907_soundverse_completion.sql`
3. `supabase/migrations/20260908000000_soundverse_activity.sql`
4. `supabase/migrations/20260908000001_auth_profile_trigger.sql`
5. `supabase/migrations/20260908000002_legacy_privacy_and_indexes.sql`

These scripts do not delete user records. They create/extend tables, replace the named policies/triggers, backfill missing profiles, and add indexes. Existing migration history was not accessible: when using the CLI, reconcile already-applied versions first; the SQL scripts themselves were tested for reapplication.

Activity keeps the composite primary key `(user_id, media_key)`, a unique generated `id`, a foreign key to `auth.users`, playback/favorite/history fields, `activity_type`, `metadata`, and creation/update timestamps. Restrictive owner policies prevent legacy permissive policies from exposing another account's activity. Optional legacy favorites/history guards apply only when those tables have a `user_id` column; unfamiliar legacy schemas need privileged inspection.

After application, verify anonymous profile reads return no rows (or permission denial), register a disposable account, confirm its profile exists, and test login/refresh/logout and activity isolation between two real accounts. Verify the API recognizes activity and that favorites survive refresh. These live checks remain outstanding.

## Feature and mobile coverage

Existing implementations were reviewed and exercised for music playback, podcast browse/detail/seasons, playlist create/edit/reorder/delete, favorites, listening history, profile editing, settings, search/filtering, admin CRUD/publishing and non-admin denial. No unimplemented button matching the searched TODO/no-op patterns was found. This is scoped test evidence, not a claim that every possible interaction has been proven.

The mobile Podcast navigation and touch styles were already present. Added end-to-end navigation/detail/playback/refresh tests at **390×844 and 375×812**. Inspected podcast screenshots and the **1440×900** desktop player. Responsive tests also cover 1920×1080, 1280×800, 768×1024, and 430×932. All are Chromium viewport tests, not physical iOS/Safari certification.

## Performance

- Paged PostgREST reads avoid silent row truncation.
- Aborted stale requests reduce redundant work and prevent late catalog replacement.
- Memoized history/favorites/progress derivation avoids recalculation on unrelated catalog changes.
- Retained route-level lazy loading, account-keyed providers, one effect-owned audio instance, and batched activity writes.
- Added partial indexes matching published-catalog browse order.
- Final main JavaScript bundle: about 495 kB / 140 kB gzip; feature pages remain separate chunks.

## Validation and evidence

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed with Vite 6.4.3.
- `npm.cmd run test:e2e`: **36 passed**, including real audio endings, shuffle/repeat, seek/resume, account isolation, both mobile podcast sizes, bulk activity sync, and catalog pagination. Results: `audit/test-results.json` and `playwright-report/index.html`.
- `npm.cmd run test:db`: **25 passed**. Results: `audit/database-results.json`.
- `npm.cmd run test:production`: 6 checks passed: bundle boot, worker activation, icon assets/dimensions, offline fallback, reconnect recovery, no uncaught browser errors.
- Dependency installation audit: 0 known vulnerabilities.
- Screenshots: `audit/podcast-390x844.png`, `audit/podcast-375x812.png`, `audit/player-1440x900.png`, and the other responsive player captures.

## Files changed or added in this pass

- `src/contexts/AuthContext.jsx`, `LibraryContext.jsx`, `AudioContext.jsx`
- `src/features/profile/Profile.jsx`, `src/components/player/GlobalPlayer.jsx`
- `src/lib/supabase.js`, `fetchRows.js`, `activityPayload.js`, `src/main.jsx`
- `index.html`, `public/sw.js`, `public/offline.html`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`
- The five migration files listed above
- `package.json`, `package-lock.json`
- `tests/fixtures.js`, `tests/v2.spec.js`, `tests/audit.spec.js`
- `audit/check-database.mjs`, `audit/check-backend.mjs`, `audit/check-production.mjs`
- Generated build/test reports and screenshots; this report

## Remaining limitations

- **Release blocker:** migrations have not been applied live; anonymous profile exposure and missing activity therefore remain live until deployment.
- Real registration/email confirmation, token refresh, account isolation, and live storage media behavior still need authenticated verification. The public-key probe cannot inspect trigger definitions or full policies.
- Catalogs are now complete across response pages, but still retained/rendered in memory. Very large catalogs need server-side search, incremental UI loading, and list virtualization; no large-scale load test was performed.
- Concurrent edits to activity across different devices still use last successful write semantics. Playlist revisions detect conflicts, but activity is not a server-merged event log.
- Offline streaming is not implemented. Unsynced browser-only activity may be lost when logging out while cloud sync is unavailable; successful logout clears private caches as requested.
- The Git index was already corrupt (`index file smaller than expected`). Git metadata was not repaired or modified; no reliable Git diff/commit could be produced.
- npm reported a locked obsolete esbuild cleanup directory. Installation, build, and security audit succeeded; no forced process termination or deletion was used to remove it.

## Reference checks

Trigger design and auth callback handling were checked against [Supabase user-management guidance](https://supabase.com/docs/guides/auth/managing-user-data) and [Supabase auth-callback deadlock guidance](https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0). Database access remains outside the synchronous auth-state callback.
