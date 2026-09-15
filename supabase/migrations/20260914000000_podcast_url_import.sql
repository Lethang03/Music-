begin;
alter table public.import_jobs drop constraint if exists import_jobs_source_type_check;
alter table public.import_jobs add constraint import_jobs_source_type_check check (source_type in ('upload','url','video','podcast_episode_url'));
alter table public.import_jobs add column if not exists podcast_id uuid references public.podcasts(id) on delete cascade;
alter table public.import_jobs add column if not exists episode_id uuid references public.episodes(id) on delete set null;
alter table public.import_jobs add column if not exists source_platform text;
alter table public.import_jobs add column if not exists source_id text;
alter table public.import_jobs drop constraint if exists import_jobs_podcast_target_check;
alter table public.import_jobs add constraint import_jobs_podcast_target_check check (source_type <> 'podcast_episode_url' or (podcast_id is not null and source_platform is not null and source_platform in ('youtube','tiktok')));
alter table public.episodes add column if not exists cover_url text;
alter table public.episodes add column if not exists source_platform text;
alter table public.episodes add column if not exists source_id text;
alter table public.episodes add column if not exists source_url text;
alter table public.episodes add column if not exists source_author text;
alter table public.episodes add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
create unique index if not exists soundverse_episode_import_job on public.episodes(import_job_id) where import_job_id is not null;
create unique index if not exists soundverse_episode_source on public.episodes(source_platform,source_id) where source_platform is not null and source_id is not null;
create unique index if not exists soundverse_podcast_active_source on public.import_jobs(source_platform,source_id) where source_type='podcast_episode_url' and source_id is not null and status not in ('failed','cancelled');
-- Stage names live in metadata.stage so existing status constraints, cancellation
-- and the stale-job claim RPC continue to work unchanged.
-- Reconcile existing lyrics migrations without assuming they were deployed.
alter table public.music_tracks add column if not exists lyrics_type text not null default 'plain';
alter table public.music_tracks add column if not exists synced_lyrics jsonb;
alter table public.music_tracks drop constraint if exists music_tracks_lyrics_type_check;
alter table public.music_tracks add constraint music_tracks_lyrics_type_check check (lyrics_type in ('plain','synced'));
alter table public.music_tracks drop constraint if exists music_tracks_synced_lyrics_array_check;
alter table public.music_tracks add constraint music_tracks_synced_lyrics_array_check check (synced_lyrics is null or jsonb_typeof(synced_lyrics) = 'array');
commit;
