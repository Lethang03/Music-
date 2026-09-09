begin;

-- Existing deployments may have received the earlier trigger body, which
-- attempted to write the intentionally absent profiles.email column.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- `role` is server-managed. A generic owner update policy is safe only when
-- this column is not granted to normal authenticated clients.
revoke update (role) on public.profiles from authenticated;

commit;
