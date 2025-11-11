create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = user_id),
    false
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy if exists "Profiles admin read" on public.profiles;
drop policy if exists "Profiles admin update" on public.profiles;
drop policy if exists "Profiles admin delete" on public.profiles;

create policy "Profiles admin read" on public.profiles
  for select using (public.is_admin(auth.uid()));

create policy "Profiles admin update" on public.profiles
  for update using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Profiles admin delete" on public.profiles
  for delete using (public.is_admin(auth.uid()));

