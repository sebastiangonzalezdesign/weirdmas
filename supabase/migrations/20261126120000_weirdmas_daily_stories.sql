-- Retire the temporary test bypass and keep challenge dates authoritative.
drop function if exists public.reset_test_challenge();
alter table public.challenge_settings drop column if exists test_mode;

create or replace function public.next_incomplete_day(requested_participant_id text)
returns integer language sql stable security definer set search_path = '' as $$
  select min(candidate.day)::integer
  from generate_series(1, 31) as candidate(day)
  where now() >= make_timestamptz(2026, 12, candidate.day, 6, 0, 0, 'America/Bogota')
    and not exists (select 1 from public.drawings d where d.participant_id = requested_participant_id and d.day = candidate.day)
$$;

create or replace function public.can_upload_day(requested_day integer)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_day between 1 and 31
    and public.current_participant_id() is not null
    and not public.is_shared_reveal_unlocked()
    and (public.next_incomplete_day(public.current_participant_id()) = requested_day
      or exists (select 1 from public.drawings d where d.participant_id = public.current_participant_id() and d.day = requested_day))
    and now() >= make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota')
$$;

create or replace function public.reveal_prompt(requested_day integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  current_participant_id_value text := public.current_participant_id();
  prompt_title text;
begin
  if current_participant_id_value is null then raise exception 'Sign in to reveal your prompt.'; end if;
  if requested_day not between 1 and 31 or public.next_incomplete_day(current_participant_id_value) is distinct from requested_day
    or now() < make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota') then
    raise exception 'That prompt is not available yet.';
  end if;
  insert into public.prompt_reveals (participant_id, day) values (current_participant_id_value, requested_day) on conflict do nothing;
  select p.title into prompt_title from public.daily_assignments a join public.prompts p on p.id = a.prompt_id
  where a.participant_id = current_participant_id_value and a.day = requested_day;
  if prompt_title is null then raise exception 'No prompt is assigned to this participant and day.'; end if;
  return prompt_title;
end;
$$;
drop function if exists public.is_test_mode();

create table public.story_entries (
  participant_id text not null references public.participants(id) on delete cascade,
  day smallint not null check (day between 1 and 31),
  content text not null check (length(content) between 1 and 20000),
  updated_at timestamptz not null default now(),
  primary key (participant_id, day)
);
alter table public.story_entries enable row level security;
grant select, insert, update on public.story_entries to authenticated;
create policy "Users manage their own daily story pages" on public.story_entries for all to authenticated
  using (participant_id = public.current_participant_id())
  with check (participant_id = public.current_participant_id());

create table public.story_submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  text_path text not null unique,
  cover_path text unique,
  uploaded_at timestamptz not null default now(),
  check (text_path like participant_id || '/story/%'),
  check (cover_path is null or cover_path like participant_id || '/story/%')
);
alter table public.story_submissions enable row level security;
grant select, insert on public.story_submissions to authenticated;
create policy "Users read their own story submissions" on public.story_submissions for select to authenticated
  using (participant_id = public.current_participant_id());
create policy "Users submit their own story after launch" on public.story_submissions for insert to authenticated
  with check (participant_id = public.current_participant_id() and now() >= make_timestamptz(2026, 12, 1, 0, 0, 0, 'America/Bogota'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weirdmas-stories', 'weirdmas-stories', false, 10485760, array['text/plain', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Users upload their own final story files after launch" on storage.objects for insert to authenticated
  with check (bucket_id = 'weirdmas-stories' and (storage.foldername(name))[1] = public.current_participant_id()
    and (storage.foldername(name))[2] = 'story' and now() >= make_timestamptz(2026, 12, 1, 0, 0, 0, 'America/Bogota'));
create policy "Users read their own final story files" on storage.objects for select to authenticated
  using (bucket_id = 'weirdmas-stories' and (storage.foldername(name))[1] = public.current_participant_id());
create policy "Users remove their own final story files" on storage.objects for delete to authenticated
  using (bucket_id = 'weirdmas-stories' and (storage.foldername(name))[1] = public.current_participant_id());
