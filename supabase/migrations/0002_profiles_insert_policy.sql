alter table public.profiles enable row level security;

create policy if not exists "Profile self insert" on public.profiles
  for insert with check (auth.uid() = id);

