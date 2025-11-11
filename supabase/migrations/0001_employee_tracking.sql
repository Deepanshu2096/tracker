-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- Custom types
create type public.user_role as enum ('employee', 'admin');
create type public.work_session_status as enum ('open', 'closed');
create type public.break_type as enum ('lunch', 'tea', 'bio', 'other');

-- Profiles table mirrors auth.users and stores roles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- User profiles with role management (employee/admin)
-- Work session tracking (check-in/out with duration)
-- Break tracking (lunch, tea, bio)
-- Activity logs (admin)
-- Work session records
create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status public.work_session_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Break records map to work sessions
create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.work_sessions(id) on delete cascade,
  type public.break_type not null default 'other',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity log for admin oversight
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists work_sessions_user_status_idx on public.work_sessions (user_id, status);
create index if not exists breaks_session_idx on public.breaks (session_id);
create index if not exists activity_logs_target_created_idx on public.activity_logs (target_user_id, created_at desc);

-- Ensure a user has at most one active (open) session
alter table public.work_sessions add constraint work_sessions_one_open_per_user
  exclude using gist (
    user_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity')) with &&
  )
  where (status = 'open');

-- Utility trigger to bump updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger work_sessions_touch before update on public.work_sessions
  for each row execute function public.touch_updated_at();
create trigger breaks_touch before update on public.breaks
  for each row execute function public.touch_updated_at();

-- Verify break timing stays within its parent session
create or replace function public.validate_break_within_session()
returns trigger
language plpgsql
as $$
declare
  session_record public.work_sessions;
begin
  select * into session_record from public.work_sessions where id = new.session_id;

  if session_record.id is null then
    raise exception 'Parent session does not exist';
  end if;

  if new.started_at < session_record.started_at then
    raise exception 'Break start precedes session start';
  end if;

  if session_record.ended_at is not null and new.started_at > session_record.ended_at then
    raise exception 'Break start exceeds session end';
  end if;

  if new.ended_at is not null then
    if new.ended_at < new.started_at then
      raise exception 'Break end precedes break start';
    end if;

    if session_record.ended_at is not null and new.ended_at > session_record.ended_at then
      raise exception 'Break end exceeds session end';
    end if;
  end if;

  return new;
end;
$$;

create trigger breaks_within_session before insert or update on public.breaks
  for each row execute function public.validate_break_within_session();

-- Maintain duration fields
create or replace function public.compute_work_session_duration()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null then
    new.duration_seconds := extract(epoch from (new.ended_at - new.started_at))::integer;
  else
    new.duration_seconds := null;
  end if;
  return new;
end;
$$;

create trigger work_sessions_duration before insert or update on public.work_sessions
  for each row execute function public.compute_work_session_duration();

create or replace function public.compute_break_duration()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null then
    new.duration_seconds := extract(epoch from (new.ended_at - new.started_at))::integer;
  else
    new.duration_seconds := null;
  end if;
  return new;
end;
$$;

create trigger breaks_duration before insert or update on public.breaks
  for each row execute function public.compute_break_duration();

-- Log work session lifecycle events
create or replace function public.log_session_changes()
returns trigger
language plpgsql
as $$
declare
  action_name text;
  payload jsonb;
begin
  if tg_op = 'INSERT' then
    action_name := 'session_started';
    payload := jsonb_build_object(
      'session_id', new.id,
      'started_at', new.started_at
    );
  elsif tg_op = 'UPDATE' and new.ended_at is not null and old.ended_at is null then
    action_name := 'session_ended';
    payload := jsonb_build_object(
      'session_id', new.id,
      'ended_at', new.ended_at,
      'duration_seconds', new.duration_seconds
    );
  else
    return new;
  end if;

  insert into public.activity_logs (actor_id, target_user_id, action, metadata)
  values (new.user_id, new.user_id, action_name, payload);

  return new;
end;
$$;

create trigger work_sessions_log after insert or update on public.work_sessions
  for each row execute function public.log_session_changes();

-- Log break lifecycle events
create or replace function public.log_break_changes()
returns trigger
language plpgsql
as $$
declare
  action_name text;
  payload jsonb;
  session_owner uuid;
begin
  select user_id into session_owner from public.work_sessions where id = new.session_id;

  if session_owner is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    action_name := 'break_started';
    payload := jsonb_build_object(
      'break_id', new.id,
      'session_id', new.session_id,
      'type', new.type,
      'started_at', new.started_at
    );
  elsif tg_op = 'UPDATE' and new.ended_at is not null and old.ended_at is null then
    action_name := 'break_ended';
    payload := jsonb_build_object(
      'break_id', new.id,
      'session_id', new.session_id,
      'ended_at', new.ended_at,
      'duration_seconds', new.duration_seconds
    );
  else
    return new;
  end if;

  insert into public.activity_logs (actor_id, target_user_id, action, metadata)
  values (session_owner, session_owner, action_name, payload);

  return new;
end;
$$;

create trigger breaks_log after insert or update on public.breaks
  for each row execute function public.log_break_changes();

-- Row level security
alter table public.profiles enable row level security;
alter table public.work_sessions enable row level security;
alter table public.breaks enable row level security;
alter table public.activity_logs enable row level security;

-- Policies for profiles
create policy "Profile self read" on public.profiles
  for select using (auth.uid() = id);

create policy "Profile self update" on public.profiles
  for update using (auth.uid() = id);

create policy "Profiles admin read" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "Profiles admin write" on public.profiles
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Policies for work_sessions
create policy "Work sessions self access" on public.work_sessions
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Work sessions admin access" on public.work_sessions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Policies for breaks
create policy "Breaks self access" on public.breaks
  using (
    exists (
      select 1 from public.work_sessions ws
      where ws.id = breaks.session_id
        and ws.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.work_sessions ws
      where ws.id = breaks.session_id
        and ws.user_id = auth.uid()
    )
  );

create policy "Breaks admin access" on public.breaks
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Policies for activity logs
create policy "Activity logs admin access" on public.activity_logs
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

create policy "Activity logs self read" on public.activity_logs
  for select using (target_user_id = auth.uid());

-- RPC helpers
create or replace function public.start_session(notes text default null)
returns public.work_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.work_sessions;
begin
  insert into public.work_sessions (user_id, notes)
  values (auth.uid(), notes)
  returning * into session_row;

  return session_row;
end;
$$;

create or replace function public.end_session(session_id uuid)
returns public.work_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.work_sessions;
begin
  update public.work_sessions
  set ended_at = now(), status = 'closed'
  where id = session_id
    and user_id = auth.uid()
    and status = 'open'
  returning * into session_row;

  if session_row.id is null then
    raise exception 'No open session found for this user';
  end if;

  return session_row;
end;
$$;

create or replace function public.start_break(session_id uuid, break_type public.break_type default 'other')
returns public.breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  break_row public.breaks;
begin
  if not exists (
    select 1 from public.work_sessions
    where id = session_id
      and user_id = auth.uid()
      and status = 'open'
  ) then
    raise exception 'Session is not open or not owned by user';
  end if;

  insert into public.breaks (session_id, type)
  values (session_id, break_type)
  returning * into break_row;

  return break_row;
end;
$$;

create or replace function public.end_break(break_id uuid)
returns public.breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  break_row public.breaks;
begin
  update public.breaks
  set ended_at = now()
  where id = break_id
    and exists (
      select 1
      from public.work_sessions ws
      where ws.id = public.breaks.session_id
        and ws.user_id = auth.uid()
    )
    and ended_at is null
  returning * into break_row;

  if break_row.id is null then
    raise exception 'Break not found or already ended';
  end if;

  return break_row;
end;
$$;
