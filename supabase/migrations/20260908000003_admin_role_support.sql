begin;

-- Add role column to profiles if it doesn't exist
alter table public.profiles add column if not exists role text default 'user';

-- Update the soundverse_is_admin function to check BOTH app_metadata and profiles.role
create or replace function public.soundverse_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ 
  select (coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'admin')
  or exists (
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  )
$$;

commit;

