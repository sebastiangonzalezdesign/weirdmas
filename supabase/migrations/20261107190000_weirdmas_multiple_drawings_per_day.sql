alter table public.drawings
  drop constraint if exists drawings_participant_id_day_key;

create or replace function public.my_challenge_state()
returns table (
  participant_id text,
  active_day integer,
  completed_days integer[],
  shared_reveal boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.participant_id,
    public.next_incomplete_day(membership.participant_id),
    coalesce((
      select array_agg(completed.day order by completed.day)
      from (
        select distinct drawing.day::integer as day
        from public.drawings as drawing
        where drawing.participant_id = membership.participant_id
      ) as completed
    ), array[]::integer[]),
    public.is_shared_reveal_unlocked()
  from public.participant_memberships as membership
  where membership.user_id = (select auth.uid())
$$;
