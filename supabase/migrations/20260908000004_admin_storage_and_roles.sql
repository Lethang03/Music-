begin;

-- Grant UPDATE on role to authenticated
grant update (role) on public.profiles to authenticated;

-- Add admin profile update policy (soundverse_profile_admin_update)
drop policy if exists soundverse_profile_admin_update on public.profiles;
create policy soundverse_profile_admin_update on public.profiles for update to authenticated
using ((select public.soundverse_is_admin()))
with check ((select public.soundverse_is_admin()));

-- CREATE STORAGE BUCKET FOR MEDIA
insert into storage.buckets (id, name, public) 
values ('soundverse', 'soundverse', true)
on conflict (id) do nothing;

-- Admin can manage everything in soundverse bucket
drop policy if exists soundverse_storage_admin_all on storage.objects;
create policy soundverse_storage_admin_all on storage.objects for all to authenticated
using (bucket_id = 'soundverse' and (select public.soundverse_is_admin()))
with check (bucket_id = 'soundverse' and (select public.soundverse_is_admin()));

-- Public can select from soundverse bucket
drop policy if exists soundverse_storage_public_read on storage.objects;
create policy soundverse_storage_public_read on storage.objects for select to public
using (bucket_id = 'soundverse');

commit;

