begin;

alter table public.music_tracks add column if not exists duration integer;
alter table public.music_tracks add column if not exists release_date date;
alter table public.music_tracks add column if not exists track_number integer;
alter table public.music_tracks add column if not exists description text;
alter table public.music_tracks add column if not exists lyrics text;
alter table public.music_tracks add column if not exists explicit_content boolean default false;

commit;

