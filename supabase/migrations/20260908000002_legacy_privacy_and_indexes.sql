begin;
-- Older versions used separate private tables. Preserve their data while
-- restricting access even when an old permissive policy remains installed.
do $$ declare legacy_table text; begin
 foreach legacy_table in array array['favorites', 'history'] loop
  if exists (select 1 from information_schema.columns where table_schema = 'public' and information_schema.columns.table_name = legacy_table and column_name = 'user_id') then
   execute format('alter table public.%I enable row level security', legacy_table);
   execute format('drop policy if exists soundverse_legacy_owner_guard on public.%I', legacy_table);
   execute format('create policy soundverse_legacy_owner_guard on public.%I as restrictive for all to anon, authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', legacy_table);
   execute format('drop policy if exists soundverse_legacy_owner on public.%I', legacy_table);
   execute format('create policy soundverse_legacy_owner on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', legacy_table);
  end if;
 end loop;
end $$;
create index if not exists soundverse_tracks_browse on public.music_tracks(created_at desc, id) where published;
create index if not exists soundverse_podcasts_browse on public.podcasts(created_at desc, id) where published;
create index if not exists soundverse_episodes_browse on public.episodes(published_at desc, id) where published;
notify pgrst, 'reload schema';
commit;
