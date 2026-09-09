begin;

-- Makes the tracks-table write idempotent if a worker invocation is retried.
alter table public.music_tracks add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
create unique index if not exists soundverse_music_tracks_import_job_id_unique on public.music_tracks(import_job_id) where import_job_id is not null;

commit;
