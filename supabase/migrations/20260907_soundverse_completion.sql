-- Apply once with privileged Supabase SQL access after reviewing existing schema/policies.
-- No records are deleted. Existing profile.role is not trusted for authorization.
begin;
create or replace function public.soundverse_is_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' $$;
revoke all on function public.soundverse_is_admin() from public;
grant execute on function public.soundverse_is_admin() to authenticated, anon;
alter table public.profiles add column if not exists username text;
create unique index if not exists soundverse_profile_username on public.profiles (lower(username)) where username is not null;
alter table public.profiles enable row level security;
drop policy if exists soundverse_profile_guard on public.profiles;
create policy soundverse_profile_guard on public.profiles as restrictive for all to anon, authenticated
using (id = (select auth.uid()) or (select public.soundverse_is_admin()))
with check (id = (select auth.uid()) or (select public.soundverse_is_admin()));
drop policy if exists soundverse_profile_owner on public.profiles;
create policy soundverse_profile_owner on public.profiles for all to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists soundverse_profile_admin_read on public.profiles;
create policy soundverse_profile_admin_read on public.profiles for select to authenticated using ((select public.soundverse_is_admin()));
revoke insert, update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name, username, avatar_url, bio) on public.profiles to authenticated;
grant update (id, display_name, username, avatar_url, bio) on public.profiles to authenticated;

create table if not exists public.playlists (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, created_at timestamptz not null default now()
);
alter table public.playlists add column if not exists revision integer not null default 0;
alter table public.playlists add column if not exists description text not null default '';
alter table public.playlists add column if not exists cover_url text;
alter table public.playlists add column if not exists track_ids uuid[] not null default '{}';
alter table public.playlists enable row level security;
create index if not exists soundverse_playlists_owner on public.playlists(user_id, created_at desc);
drop policy if exists soundverse_playlist_guard on public.playlists;
create policy soundverse_playlist_guard on public.playlists as restrictive for all to anon, authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists soundverse_playlist_owner on public.playlists;
create policy soundverse_playlist_owner on public.playlists for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.playlists to authenticated;
create or replace function public.soundverse_validate_playlist() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare existing_ids uuid[] := '{}'; begin
 if tg_op = 'UPDATE' then existing_ids := old.track_ids; end if;
 if length(trim(new.name)) = 0 or length(new.name) > 120 then raise exception 'Playlist name must contain 1–120 characters'; end if;
 if cardinality(new.track_ids) > 1000 then raise exception 'A playlist can contain at most 1000 songs'; end if;
 if exists (select 1 from unnest(new.track_ids) t(id) where not (t.id = any(existing_ids)) and not exists (select 1 from public.music_tracks m where m.id = t.id and m.published)) then raise exception 'Playlist contains an unavailable song'; end if;
 return new;
end $$;
drop trigger if exists soundverse_validate_playlist on public.playlists;
create trigger soundverse_validate_playlist before insert or update on public.playlists for each row execute function public.soundverse_validate_playlist();

create table if not exists public.soundverse_activity (
 user_id uuid not null references auth.users(id) on delete cascade,
 media_key text not null check (length(media_key) <= 100), item jsonb not null,
 position double precision not null default 0 check (position >= 0), duration double precision not null default 0 check (duration >= 0),
 completed boolean not null default false, liked boolean not null default false,
 listened_seconds double precision not null default 0 check (listened_seconds >= 0), listening_days text[] not null default '{}',
 played_at timestamptz, updated_at timestamptz not null default now(), primary key (user_id, media_key)
);
alter table public.soundverse_activity enable row level security;
drop policy if exists soundverse_activity_owner on public.soundverse_activity;
create policy soundverse_activity_owner on public.soundverse_activity for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.soundverse_activity to authenticated;
create index if not exists soundverse_activity_recent on public.soundverse_activity(user_id, played_at desc);
alter table public.music_tracks add column if not exists genre text;
alter table public.music_tracks enable row level security;
alter table public.podcasts enable row level security;
alter table public.episodes enable row level security;
drop policy if exists soundverse_music_read_guard on public.music_tracks;
create policy soundverse_music_read_guard on public.music_tracks as restrictive for select to anon, authenticated using (published or (select public.soundverse_is_admin()));
drop policy if exists soundverse_music_read on public.music_tracks;
create policy soundverse_music_read on public.music_tracks for select to anon, authenticated using (published or (select public.soundverse_is_admin()));
drop policy if exists soundverse_podcast_read_guard on public.podcasts;
create policy soundverse_podcast_read_guard on public.podcasts as restrictive for select to anon, authenticated using (published or (select public.soundverse_is_admin()));
drop policy if exists soundverse_podcast_read on public.podcasts;
create policy soundverse_podcast_read on public.podcasts for select to anon, authenticated using (published or (select public.soundverse_is_admin()));
drop policy if exists soundverse_episode_read_guard on public.episodes;
create policy soundverse_episode_read_guard on public.episodes as restrictive for select to anon, authenticated
using ((published and exists (select 1 from public.podcasts p where p.id = podcast_id and p.published)) or (select public.soundverse_is_admin()));
drop policy if exists soundverse_episode_read on public.episodes;
create policy soundverse_episode_read on public.episodes for select to anon, authenticated
using ((published and exists (select 1 from public.podcasts p where p.id = podcast_id and p.published)) or (select public.soundverse_is_admin()));
do $$ declare table_name text; begin
 foreach table_name in array array['music_tracks', 'podcasts', 'episodes'] loop
  execute format('drop policy if exists soundverse_admin_insert_guard on public.%I', table_name);
  execute format('drop policy if exists soundverse_admin_update_guard on public.%I', table_name);
  execute format('drop policy if exists soundverse_admin_delete_guard on public.%I', table_name);
  execute format('drop policy if exists soundverse_admin_write on public.%I', table_name);
  execute format('create policy soundverse_admin_insert_guard on public.%I as restrictive for insert to anon, authenticated with check ((select public.soundverse_is_admin()))', table_name);
  execute format('create policy soundverse_admin_update_guard on public.%I as restrictive for update to anon, authenticated using ((select public.soundverse_is_admin())) with check ((select public.soundverse_is_admin()))', table_name);
  execute format('create policy soundverse_admin_delete_guard on public.%I as restrictive for delete to anon, authenticated using ((select public.soundverse_is_admin()))', table_name);
  execute format('create policy soundverse_admin_write on public.%I for all to authenticated using ((select public.soundverse_is_admin())) with check ((select public.soundverse_is_admin()))', table_name);
  execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
 end loop;
end $$;
create index if not exists soundverse_episode_order on public.episodes(podcast_id, season_number, episode_number) where published;
commit;
