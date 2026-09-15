# Podcast episode numbering fix

## Root cause

The public podcast detail page presented a flat list but sorted it by season and persisted episode number. It then displayed `episode_number` when available and a local array index only when it was absent. Duplicate values and values that restarted per season therefore appeared as visible resets in one ungrouped list.

Manual episode creation, RSS entries without `itunes:episode`, and successful TikTok/YouTube worker imports could all persist `null` for `episode_number`. RSS also created a new podcast shell for the same feed on every import, so it had no source identity with which to skip an already imported enclosure.

## New behavior

`src/lib/episodeOrder.js` creates one normalized flat ordering for the public list: valid episode number, then `published_at`, then `created_at`, then ID. The rendered number is always its position in that one ordered list, so duplicate or missing stored values remain a stable visible sequence of 1, 2, 3 and so on.

The prior season tabs were removed because they presented one flat list and did not communicate a separately numbered season view. Season metadata remains stored and available to administration; it no longer resets the public list.

Playback remains keyed by `episode.id`. The queue uses the ordered episode objects, and display numbers are not identities or progress keys.

## Automatic numbering and imports

The new migration `20260915000000_podcast_episode_numbering.sql` adds a per-podcast, advisory-lock-protected `before insert` trigger. Any omitted episode number becomes the current maximum valid number for that podcast plus one. Explicit positive values remain unchanged; no historical episodes, dates, media URLs, IDs, progress, or season values are rewritten.

The manual Admin form also calculates a next number before insert, which gives immediate normal behavior while the database trigger remains the concurrency-safe authority. The existing worker can keep submitting `null`; the trigger assigns the value after a successful TikTok or YouTube import.

RSS uses valid `itunes:episode` values when supplied. Missing values are assigned from the next available number after ordering the incoming batch deterministically by publication date. The importer now stores the feed URL on the podcast, reuses that podcast on a later sync, records enclosure URLs as episode sources, and skips already imported enclosures. New unique partial indexes protect this data after migration.

No unique episode-number constraint was added: existing duplicate values remain compatible, and the UI handles them safely without deleting or silently renumbering production records.

## Files changed

- `src/features/podcast/PodcastDetail.jsx`
- `src/features/admin/components/AdminEpisodes.jsx`
- `src/features/admin/components/AdminPodcastImport.jsx`
- `src/lib/episodeOrder.js`
- `supabase/migrations/20260915000000_podcast_episode_numbering.sql`
- `tests/episode-numbering.spec.js`

## Verification

- Focused Playwright: PASS, 3/3.
- Build, lint, and the requested `tests/v2.spec.js` regression run: pending final run.

Focused tests cover continuous display for duplicate/missing values, source-neutral omitted-number allocation for RSS/TikTok/YouTube/manual creation, RSS batch order, and publication-date fallback ordering. Existing regression coverage verifies podcast progress remains attached to episode IDs.
