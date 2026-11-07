alter table public.challenge_settings
  add column if not exists test_mode boolean not null default false;

update public.challenge_settings
set test_mode = true
where singleton = true;

create or replace function public.is_test_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select settings.test_mode
    from public.challenge_settings as settings
    where settings.singleton
  ), false)
$$;

create or replace function public.next_incomplete_day(requested_participant_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select min(candidate.day)::integer
  from generate_series(1, 31) as candidate(day)
  where (
    public.is_test_mode()
    or now() >= make_timestamptz(2026, 12, candidate.day, 6, 0, 0, 'America/Bogota')
  )
    and not exists (
    select 1
    from public.drawings as drawing
    where drawing.participant_id = requested_participant_id
      and drawing.day = candidate.day
  )
$$;

create or replace function public.can_upload_day(requested_day integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_day between 1 and 31
    and public.current_participant_id() is not null
    and not public.is_shared_reveal_unlocked()
    and (
      public.next_incomplete_day(public.current_participant_id()) = requested_day
      or exists (
        select 1
        from public.drawings as drawing
        where drawing.participant_id = public.current_participant_id()
          and drawing.day = requested_day
      )
    )
    and (
      public.is_test_mode()
      or now() >= make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota')
    )
$$;

create or replace function public.reveal_prompt(requested_day integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_participant_id_value text := public.current_participant_id();
  prompt_title text;
begin
  if current_participant_id_value is null then
    raise exception 'Sign in to reveal your prompt.';
  end if;
  if requested_day not between 1 and 31
    or public.next_incomplete_day(current_participant_id_value) is distinct from requested_day
    or (
      not public.is_test_mode()
      and now() < make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota')
    ) then
    raise exception 'That prompt is not available yet.';
  end if;

  insert into public.prompt_reveals (participant_id, day)
  values (current_participant_id_value, requested_day)
  on conflict (participant_id, day) do nothing;

  select prompt.title
  into prompt_title
  from public.daily_assignments as assignment
  join public.prompts as prompt on prompt.id = assignment.prompt_id
  where assignment.participant_id = current_participant_id_value
    and assignment.day = requested_day;

  if prompt_title is null then
    raise exception 'No prompt is assigned to this participant and day.';
  end if;
  return prompt_title;
end;
$$;

create or replace function public.reset_test_challenge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_participant_id() is distinct from 'sebastian' then
    raise exception 'Only the Sebastian profile can reset test progress.';
  end if;
  if not public.is_test_mode() then
    raise exception 'Test mode must be enabled to reset challenge progress.';
  end if;

  delete from storage.objects
  where bucket_id = 'weirdmas-drawings';

  delete from public.drawings;
  delete from public.prompt_reveals;

  update public.challenge_settings
  set force_shared_reveal = false
  where singleton = true;
end;
$$;

revoke all on function public.is_test_mode() from public, anon;
revoke all on function public.reset_test_challenge() from public, anon;
grant execute on function public.is_test_mode() to authenticated;
grant execute on function public.reset_test_challenge() to authenticated;
