-- Align legacy music_tracks rows with every field consumed by the application.
-- This is additive: it intentionally preserves plain and synced lyrics data.
begin;

-- The frontend accepts older catalog rows whose artwork was returned as image_url,
-- while new writes use cover_url. Keep both names available during the transition.
alter table public.music_tracks add column if not exists image_url text;

-- Keep the lyrics contract explicit for databases that predate the lyrics migrations.
-- IF NOT EXISTS means existing lyrics and synced_lyrics values are never replaced.
alter table public.music_tracks add column if not exists lyrics text;
alter table public.music_tracks add column if not exists lyrics_type text not null default 'plain';
alter table public.music_tracks add column if not exists synced_lyrics jsonb;

alter table public.music_tracks drop constraint if exists music_tracks_lyrics_type_check;
alter table public.music_tracks add constraint music_tracks_lyrics_type_check
  check (lyrics_type in ('plain', 'synced'));

alter table public.music_tracks drop constraint if exists music_tracks_synced_lyrics_array_check;
alter table public.music_tracks add constraint music_tracks_synced_lyrics_array_check
  check (synced_lyrics is null or jsonb_typeof(synced_lyrics) = 'array');

commit;
