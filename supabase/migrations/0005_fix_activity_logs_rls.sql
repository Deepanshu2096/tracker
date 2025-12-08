-- Fix RLS policies for activity_logs to allow trigger functions to insert
-- The trigger functions need to be able to insert activity logs on behalf of users

-- Add policy to allow users to insert their own activity logs
-- This is needed for the trigger functions that log session/break events
create policy "Activity logs self insert" on public.activity_logs
  for insert with check (
    actor_id = auth.uid() and target_user_id = auth.uid()
  );

-- Update trigger functions to use SECURITY DEFINER so they can bypass RLS
-- This ensures the triggers can insert logs even when called by regular users

-- Update log_session_changes function
create or replace function public.log_session_changes()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- Update log_break_changes function
create or replace function public.log_break_changes()
returns trigger
language plpgsql
security definer
set search_path = public
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

