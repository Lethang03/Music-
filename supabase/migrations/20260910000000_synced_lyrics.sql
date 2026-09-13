begin;

alter table public.music_tracks add column if not exists lyrics_type text not null default 'plain';
alter table public.music_tracks add column if not exists synced_lyrics jsonb;

alter table public.music_tracks drop constraint if exists music_tracks_lyrics_type_check;
alter table public.music_tracks add constraint music_tracks_lyrics_type_check check (lyrics_type in ('plain', 'synced'));
alter table public.music_tracks drop constraint if exists music_tracks_synced_lyrics_array_check;
alter table public.music_tracks add constraint music_tracks_synced_lyrics_array_check check (synced_lyrics is null or jsonb_typeof(synced_lyrics) = 'array');

commit;
