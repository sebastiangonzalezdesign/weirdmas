create extension if not exists pgcrypto;

create table public.participants (
  id text primary key,
  name text not null,
  role text not null default '',
  avatar_path text not null default '',
  is_active boolean not null default true
);

create table public.prompts (
  id smallint primary key check (id between 1 and 31),
  title text not null unique
);

create table public.participant_claim_codes (
  participant_id text primary key references public.participants(id) on delete cascade,
  code_hash text not null,
  issued_at timestamptz not null default now(),
  claimed_at timestamptz
);

create table public.participant_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_id text not null unique references public.participants(id) on delete restrict,
  bound_at timestamptz not null default now()
);

create table public.daily_assignments (
  day smallint not null check (day between 1 and 31),
  participant_id text not null references public.participants(id) on delete cascade,
  prompt_id smallint not null references public.prompts(id) on delete restrict,
  primary key (day, participant_id),
  unique (day, prompt_id)
);

create table public.prompt_reveals (
  participant_id text not null references public.participants(id) on delete cascade,
  day smallint not null check (day between 1 and 31),
  revealed_at timestamptz not null default now(),
  primary key (participant_id, day),
  foreign key (day, participant_id) references public.daily_assignments(day, participant_id) on delete cascade
);

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null references public.participants(id) on delete cascade,
  day smallint not null check (day between 1 and 31),
  name text not null check (length(name) between 1 and 255),
  storage_path text not null unique,
  uploaded_at timestamptz not null default now(),
  unique (participant_id, day),
  check (storage_path like participant_id || '/' || day::text || '/%')
);

create table public.challenge_settings (
  singleton boolean primary key default true check (singleton),
  force_shared_reveal boolean not null default false
);

insert into public.participants (id, name, role, avatar_path) values
  ('lu', 'Lu', 'Anime Expert', '/assets/avatars/Lu.svg'),
  ('sebastian', 'Sebastian', 'Time Travel Fan', '/assets/avatars/Sebastian.svg');

insert into public.prompts (id, title) values
  (1, 'Frozen'),
  (2, 'Dead trees'),
  (3, 'Winter walk'),
  (4, 'Dark Nights'),
  (5, 'Long shadows'),
  (6, 'Moon & stars'),
  (7, 'Snowed in'),
  (8, 'Empty nest'),
  (9, 'Kicles'),
  (10, 'Reindeer'),
  (11, 'Storybook'),
  (12, 'Childhood'),
  (13, 'Wolves'),
  (14, 'Fuegos Fatuos'),
  (15, 'Fireside'),
  (16, 'Sweet Treat'),
  (17, 'Wreath'),
  (18, 'Ribbon'),
  (19, 'Angels'),
  (20, 'Gift'),
  (21, 'Toys'),
  (22, 'Heat'),
  (23, 'Snow'),
  (24, 'Nightmare'),
  (25, 'Eyes'),
  (26, 'Tea cup'),
  (27, 'Hypnotized'),
  (28, 'Peony'),
  (29, 'Dark Academia'),
  (30, 'Blood Bath'),
  (31, 'Scarf');

insert into public.daily_assignments (day, participant_id, prompt_id) values
  (1, 'lu', 7), (1, 'sebastian', 6),
  (2, 'lu', 13), (2, 'sebastian', 12),
  (3, 'lu', 27), (3, 'sebastian', 26),
  (4, 'lu', 30), (4, 'sebastian', 6),
  (5, 'lu', 3), (5, 'sebastian', 2),
  (6, 'lu', 17), (6, 'sebastian', 16),
  (7, 'lu', 10), (7, 'sebastian', 11),
  (8, 'lu', 19), (8, 'sebastian', 18),
  (9, 'lu', 18), (9, 'sebastian', 19),
  (10, 'lu', 29), (10, 'sebastian', 28),
  (11, 'lu', 5), (11, 'sebastian', 6),
  (12, 'lu', 27), (12, 'sebastian', 30),
  (13, 'lu', 2), (13, 'sebastian', 3),
  (14, 'lu', 9), (14, 'sebastian', 8),
  (15, 'lu', 19), (15, 'sebastian', 18),
  (16, 'lu', 29), (16, 'sebastian', 28),
  (17, 'lu', 31), (17, 'sebastian', 30),
  (18, 'lu', 18), (18, 'sebastian', 19),
  (19, 'lu', 26), (19, 'sebastian', 27),
  (20, 'lu', 7), (20, 'sebastian', 1),
  (21, 'lu', 10), (21, 'sebastian', 11),
  (22, 'lu', 28), (22, 'sebastian', 29),
  (23, 'lu', 16), (23, 'sebastian', 17),
  (24, 'lu', 13), (24, 'sebastian', 12),
  (25, 'lu', 5), (25, 'sebastian', 4),
  (26, 'lu', 8), (26, 'sebastian', 9),
  (27, 'lu', 7), (27, 'sebastian', 6),
  (28, 'lu', 4), (28, 'sebastian', 5),
  (29, 'lu', 1), (29, 'sebastian', 3),
  (30, 'lu', 7), (30, 'sebastian', 6),
  (31, 'lu', 8), (31, 'sebastian', 9);

insert into public.challenge_settings (singleton) values (true);

create or replace function public.current_participant_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.participant_id
  from public.participant_memberships as membership
  where membership.user_id = (select auth.uid())
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
  where now() >= make_timestamptz(2026, 12, candidate.day, 6, 0, 0, 'America/Bogota')
    and not exists (
      select 1
      from public.drawings as drawing
      where drawing.participant_id = requested_participant_id
        and drawing.day = candidate.day
    )
$$;

create or replace function public.is_shared_reveal_unlocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select settings.force_shared_reveal
    from public.challenge_settings as settings
    where settings.singleton
  ), false)
  or (
    exists (select 1 from public.participants where is_active)
    and not exists (
      select 1
      from public.participants as participant
      cross join generate_series(1, 31) as challenge_day(day)
      where participant.is_active
        and not exists (
          select 1
          from public.drawings as drawing
          where drawing.participant_id = participant.id
            and drawing.day = challenge_day.day
        )
    )
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
    and now() >= make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota')
$$;

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
      select array_agg(drawing.day::integer order by drawing.day)
      from public.drawings as drawing
      where drawing.participant_id = membership.participant_id
    ), array[]::integer[]),
    public.is_shared_reveal_unlocked()
  from public.participant_memberships as membership
  where membership.user_id = (select auth.uid())
$$;

create or replace function public.issue_participant_claim_code(requested_participant_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  issued_code text := pg_catalog.gen_random_uuid()::text;
begin
  if not exists (
    select 1
    from public.participants as participant
    where participant.id = requested_participant_id
      and participant.is_active
  ) then
    raise exception 'The selected profile is not active.';
  end if;

  insert into public.participant_claim_codes as existing
    (participant_id, code_hash, issued_at, claimed_at)
  values
    (requested_participant_id, pg_catalog.md5(issued_code), pg_catalog.now(), null)
  on conflict (participant_id) do update
    set code_hash = excluded.code_hash,
        issued_at = excluded.issued_at,
        claimed_at = null
    where existing.claimed_at is null;

  if not found then
    raise exception 'This profile has already been claimed; its code cannot be replaced.';
  end if;

  return issued_code;
end;
$$;

create or replace function public.bind_participant(requested_participant_id text, requested_claim_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := (select auth.uid());
  existing_participant_id text;
  claim_code_hash text;
  claim_code_claimed_at timestamptz;
begin
  if account_id is null then
    raise exception 'Verify your email before claiming a profile.';
  end if;

  select membership.participant_id
  into existing_participant_id
  from public.participant_memberships as membership
  where membership.user_id = account_id;

  if existing_participant_id is not null then
    if existing_participant_id <> requested_participant_id then
      raise exception 'This account is already bound to another profile.';
    end if;
    return existing_participant_id;
  end if;

  select claim.code_hash, claim.claimed_at
  into claim_code_hash, claim_code_claimed_at
  from public.participant_claim_codes as claim
  join public.participants as participant
    on participant.id = claim.participant_id
  where claim.participant_id = requested_participant_id
    and participant.is_active
  for update of claim;

  if not found
    or claim_code_claimed_at is not null
    or requested_claim_code is null
    or pg_catalog.md5(btrim(requested_claim_code)) <> claim_code_hash
  then
    raise exception 'The one-time profile code is invalid or has already been used.';
  end if;

  insert into public.participant_memberships (user_id, participant_id)
  values (account_id, requested_participant_id);
  update public.participant_claim_codes
  set claimed_at = pg_catalog.now()
  where participant_id = requested_participant_id;
  return requested_participant_id;
exception
  when unique_violation then
    raise exception 'This profile is already bound to another account.';
end;
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
    or now() < make_timestamptz(2026, 12, requested_day, 6, 0, 0, 'America/Bogota') then
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

alter table public.participants enable row level security;
alter table public.prompts enable row level security;
alter table public.participant_claim_codes enable row level security;
alter table public.participant_memberships enable row level security;
alter table public.daily_assignments enable row level security;
alter table public.prompt_reveals enable row level security;
alter table public.drawings enable row level security;
alter table public.challenge_settings enable row level security;

grant select on public.participants to anon, authenticated;
grant select on public.prompts, public.daily_assignments, public.prompt_reveals, public.drawings to authenticated;
grant insert, update on public.drawings to authenticated;

create policy "Anyone can read participant display data"
on public.participants for select to anon, authenticated
using (true);

create policy "Users can read only their own membership"
on public.participant_memberships for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read revealed assignments"
on public.daily_assignments for select to authenticated
using (
  public.is_shared_reveal_unlocked()
  or (
    participant_id = public.current_participant_id()
    and exists (
      select 1 from public.prompt_reveals as reveal
      where reveal.participant_id = daily_assignments.participant_id
        and reveal.day = daily_assignments.day
    )
  )
);

create policy "Users can read only prompts available to their history"
on public.prompts for select to authenticated
using (
  public.is_shared_reveal_unlocked()
  or exists (
    select 1
    from public.daily_assignments as assignment
    join public.prompt_reveals as reveal
      on reveal.participant_id = assignment.participant_id
      and reveal.day = assignment.day
    where assignment.prompt_id = prompts.id
      and assignment.participant_id = public.current_participant_id()
  )
);

create policy "Users can read their own prompt reveals"
on public.prompt_reveals for select to authenticated
using (participant_id = public.current_participant_id());

create policy "Users can read their own drawings until shared reveal"
on public.drawings for select to authenticated
using (
  participant_id = public.current_participant_id()
  or public.is_shared_reveal_unlocked()
);

create policy "Users can upload or replace their eligible drawing"
on public.drawings for insert to authenticated
with check (
  participant_id = public.current_participant_id()
  and public.can_upload_day(day)
  and exists (
    select 1 from public.prompt_reveals as reveal
    where reveal.participant_id = drawings.participant_id
      and reveal.day = drawings.day
  )
);

create policy "Users can replace their eligible drawing"
on public.drawings for update to authenticated
using (
  participant_id = public.current_participant_id()
  and public.can_upload_day(day)
)
with check (
  participant_id = public.current_participant_id()
  and public.can_upload_day(day)
  and exists (
    select 1 from public.prompt_reveals as reveal
    where reveal.participant_id = drawings.participant_id
      and reveal.day = drawings.day
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'weirdmas-drawings',
  'weirdmas-drawings',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.validate_drawing_storage_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'weirdmas-drawings'
      and object.name = new.storage_path
  ) then
    raise exception 'The drawing file must be uploaded to private storage before saving its record.';
  end if;
  new.uploaded_at = now();
  return new;
end;
$$;

create trigger validate_drawing_storage_object_before_save
before insert or update of participant_id, day, storage_path on public.drawings
for each row execute function public.validate_drawing_storage_object();

create policy "Users can read their own drawings or shared histories"
on storage.objects for select to authenticated
using (
  bucket_id = 'weirdmas-drawings'
  and (
    (storage.foldername(name))[1] = public.current_participant_id()
    or public.is_shared_reveal_unlocked()
  )
);

create policy "Users can upload into their eligible participant day"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'weirdmas-drawings'
  and (storage.foldername(name))[1] = public.current_participant_id()
  and case
    when (storage.foldername(name))[2] ~ '^[0-9]{1,2}$'
      then public.can_upload_day(((storage.foldername(name))[2])::integer)
    else false
  end
);

create policy "Users can remove only their own stored drawings"
on storage.objects for delete to authenticated
using (
  bucket_id = 'weirdmas-drawings'
  and (storage.foldername(name))[1] = public.current_participant_id()
  and not exists (
    select 1
    from public.drawings as drawing
    where drawing.storage_path = name
  )
);

revoke all on public.participant_claim_codes, public.challenge_settings from anon, authenticated;
revoke all on function public.current_participant_id() from public, anon;
revoke all on function public.next_incomplete_day(text) from public, anon, authenticated;
revoke all on function public.is_shared_reveal_unlocked() from public, anon;
revoke all on function public.can_upload_day(integer) from public, anon;
revoke all on function public.my_challenge_state() from public, anon;
revoke all on function public.issue_participant_claim_code(text) from public, anon, authenticated;
revoke all on function public.bind_participant(text, text) from public, anon;
revoke all on function public.reveal_prompt(integer) from public, anon;
revoke all on function public.validate_drawing_storage_object() from public, anon, authenticated;
grant execute on function public.current_participant_id() to authenticated;
grant execute on function public.is_shared_reveal_unlocked() to authenticated;
grant execute on function public.can_upload_day(integer) to authenticated;
grant execute on function public.my_challenge_state() to authenticated;
grant execute on function public.bind_participant(text, text) to authenticated;
grant execute on function public.reveal_prompt(integer) to authenticated;
