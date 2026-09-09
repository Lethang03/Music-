begin;

-- Keep cancellation as an administrative terminal state while adding the
-- worker's explicit extraction phase.
alter table public.import_jobs drop constraint if exists import_jobs_status_check;
alter table public.import_jobs add constraint import_jobs_status_check
  check (status in ('pending', 'processing', 'extracting', 'uploading', 'completed', 'failed', 'cancelled'));

commit;
