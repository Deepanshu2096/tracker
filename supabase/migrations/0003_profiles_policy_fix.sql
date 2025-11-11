drop policy if exists "Profiles admin write" on public.profiles;
drop policy if exists "Profiles admin update" on public.profiles;
drop policy if exists "Profiles admin delete" on public.profiles;

create policy "Profiles admin update" on public.profiles
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "Profiles admin delete" on public.profiles
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

