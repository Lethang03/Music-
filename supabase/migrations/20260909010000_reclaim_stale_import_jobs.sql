begin;

-- A process can be interrupted after claiming a job (deploy, host restart,
-- or transient network failure).  Reclaim only work that has made no progress
-- for an hour; normal manual retry remains available for terminal failures.
create or replace function public.claim_audio_import_job()
returns setof public.import_jobs
language plpgsql security definer set search_path = public
as $$
declare claimed public.import_jobs;
begin
  select * into claimed from public.import_jobs
  where status = 'pending'
     or (status in ('processing', 'extracting', 'uploading')
         and started_at < now() - interval '1 hour')
  order by created_at
  for update skip locked limit 1;
  if not found then return; end if;

  update public.import_jobs
  set status = 'processing', progress = 5, started_at = now(),
      error_message = null,
      retry_count = case when claimed.status = 'pending' then retry_count else retry_count + 1 end
  where id = claimed.id
  returning * into claimed;
  return next claimed;
end;
$$;

revoke all on function public.claim_audio_import_job() from public;
grant execute on function public.claim_audio_import_job() to service_role;

commit;
