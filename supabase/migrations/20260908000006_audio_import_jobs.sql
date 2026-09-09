begin;

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_type text not null check (source_type in ('upload', 'url', 'video')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'uploading', 'completed', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  error_message text,
  track_id uuid references public.music_tracks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0)
);

create index if not exists soundverse_import_jobs_queue on public.import_jobs(status, created_at);
create index if not exists soundverse_import_jobs_creator on public.import_jobs(created_by, created_at desc);
alter table public.import_jobs enable row level security;

drop policy if exists soundverse_import_jobs_admin_read on public.import_jobs;
create policy soundverse_import_jobs_admin_read on public.import_jobs for select to authenticated
using ((select public.soundverse_is_admin()));
drop policy if exists soundverse_import_jobs_admin_write on public.import_jobs;
create policy soundverse_import_jobs_admin_write on public.import_jobs for all to authenticated
using ((select public.soundverse_is_admin())) with check ((select public.soundverse_is_admin()));
grant select, insert, update, delete on public.import_jobs to authenticated;

-- Atomically claims one queued job so multiple worker replicas cannot process it twice.
create or replace function public.claim_audio_import_job()
returns setof public.import_jobs
language plpgsql security definer set search_path = public
as $$
declare claimed public.import_jobs;
begin
  select * into claimed from public.import_jobs
  where status = 'pending' order by created_at
  for update skip locked limit 1;
  if not found then return; end if;
  update public.import_jobs set status = 'processing', progress = 5, started_at = now(), error_message = null
  where id = claimed.id returning * into claimed;
  return next claimed;
end;
$$;
revoke all on function public.claim_audio_import_job() from public;
grant execute on function public.claim_audio_import_job() to service_role;

commit;
