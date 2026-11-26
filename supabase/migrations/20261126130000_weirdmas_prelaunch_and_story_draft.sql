-- Let participants exercise the calendar and uploads before the real challenge starts.
create or replace function public.can_upload_day(requested_day integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_day between 1 and 31
    and public.current_participant_id() is not null
    and (
      now() < make_timestamptz(2026, 12, 1, 6, 0, 0, 'America/Bogota')
      or (
        not public.is_shared_reveal_unlocked()
        and (
          public.next_incomplete_day(public.current_participant_id()) = requested_day
          or exists (select 1 from public.drawings d where d.participant_id = public.current_participant_id() and d.day = requested_day)
        )
        and now() >= make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota')
      )
    )
$$;

drop policy if exists "Users can upload or replace their eligible drawing" on public.drawings;
create policy "Users can upload or replace their eligible drawing"
on public.drawings for insert to authenticated
with check (participant_id = public.current_participant_id() and public.can_upload_day(day));

drop policy if exists "Users can replace their eligible drawing" on public.drawings;
create policy "Users can replace their eligible drawing"
on public.drawings for update to authenticated
using (participant_id = public.current_participant_id() and public.can_upload_day(day))
with check (participant_id = public.current_participant_id() and public.can_upload_day(day));

drop policy if exists "Users can upload into their eligible participant day" on storage.objects;
create policy "Users can upload into their eligible participant day"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'weirdmas-drawings'
  and (storage.foldername(name))[1] = public.current_participant_id()
  and case when (storage.foldername(name))[2] ~ '^[0-9]{1,2}$'
    then public.can_upload_day(((storage.foldername(name))[2])::integer)
    else false end
);

create or replace function public.can_manage_final_story()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_participant_id() is not null
    and (
      now() < make_timestamptz(2026, 12, 1, 6, 0, 0, 'America/Bogota')
      or not exists (
        select 1 from generate_series(1, 31) as challenge_day(day)
        where not exists (
          select 1 from public.drawings d
          where d.participant_id = public.current_participant_id() and d.day = challenge_day.day
        )
      )
    )
$$;
grant execute on function public.can_manage_final_story() to authenticated;

drop policy if exists "Users submit their own story after launch" on public.story_submissions;
create policy "Users save their draft or completed story"
on public.story_submissions for insert to authenticated
with check (participant_id = public.current_participant_id() and public.can_manage_final_story());
create policy "Users replace their own story"
on public.story_submissions for update to authenticated
using (participant_id = public.current_participant_id() and public.can_manage_final_story())
with check (participant_id = public.current_participant_id() and public.can_manage_final_story());
grant update on public.story_submissions to authenticated;

drop policy if exists "Users upload their own final story files after launch" on storage.objects;
create policy "Users upload their own final story files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'weirdmas-stories'
  and (storage.foldername(name))[1] = public.current_participant_id()
  and (storage.foldername(name))[2] = 'story'
  and public.can_manage_final_story()
);

-- Clear only prelaunch drawings and prompt reveals at the official day-one start.
create extension if not exists pg_cron with schema pg_catalog;
alter table public.challenge_settings
  add column if not exists prelaunch_reset_done boolean not null default false;

create or replace function public.reset_prelaunch_drawings()
returns void language plpgsql security definer set search_path = '' as $$
declare
  already_reset boolean;
begin
  select settings.prelaunch_reset_done into already_reset
  from public.challenge_settings as settings
  where settings.singleton
  for update;
  if already_reset then return; end if;
  if now() < make_timestamptz(2026, 12, 1, 6, 0, 0, 'America/Bogota') then
    raise exception 'Prelaunch drawings cannot be reset before the challenge starts.';
  end if;
  if now() >= make_timestamptz(2026, 12, 2, 6, 0, 0, 'America/Bogota') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'weirdmas-clear-prelaunch-drawings';
    return;
  end if;
  delete from storage.objects where bucket_id = 'weirdmas-drawings';
  delete from public.drawings;
  delete from public.prompt_reveals;
  update public.challenge_settings
  set force_shared_reveal = false, prelaunch_reset_done = true
  where singleton = true;
  perform cron.unschedule(jobid) from cron.job where jobname = 'weirdmas-clear-prelaunch-drawings';
end;
$$;
revoke all on function public.reset_prelaunch_drawings() from public, anon;
grant execute on function public.reset_prelaunch_drawings() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'weirdmas-clear-prelaunch-drawings';
select cron.schedule(
  'weirdmas-clear-prelaunch-drawings',
  '0 11 1 12 *',
  $$select public.reset_prelaunch_drawings();$$
);
