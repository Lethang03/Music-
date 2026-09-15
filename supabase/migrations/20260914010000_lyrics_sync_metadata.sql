-- Additive metadata columns for automated lyrics synchronization.
-- Preserves all existing tables, rows, policies, and constraints.
begin;

alter table public.music_tracks add column if not exists source_url text;
alter table public.music_tracks add column if not exists source_platform text;
alter table public.music_tracks add column if not exists source_id text;
alter table public.music_tracks add column if not exists lyrics_sync_confidence numeric;
alter table public.music_tracks add column if not exists lyrics_synced_at timestamptz;
alter table public.music_tracks add column if not exists lyrics_sync_source_url text;

commit;

