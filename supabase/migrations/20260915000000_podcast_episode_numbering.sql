begin;

alter table public.podcasts add column if not exists rss_feed_url text;
create unique index if not exists soundverse_podcast_rss_feed_url
  on public.podcasts(rss_feed_url) where rss_feed_url is not null;
create unique index if not exists soundverse_episode_rss_source
  on public.episodes(podcast_id, source_url) where source_url is not null;

-- Missing numbers are allocated atomically for each podcast. Explicit values
-- remain untouched for compatibility with feeds and existing admin work.
create or replace function public.soundverse_assign_episode_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.episode_number is null then
    perform pg_advisory_xact_lock(hashtextextended(new.podcast_id::text, 0));
    select coalesce(max(e.episode_number), 0) + 1 into new.episode_number
      from public.episodes e
      where e.podcast_id = new.podcast_id and e.episode_number > 0;
  end if;
  return new;
end;
$$;

drop trigger if exists soundverse_assign_episode_number on public.episodes;
create trigger soundverse_assign_episode_number
before insert on public.episodes
for each row execute function public.soundverse_assign_episode_number();

commit;
