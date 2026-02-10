-- Employer business location (coarse by default, exact optional)
alter table public.employer_profiles
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_zip text,
  add column if not exists location_address_line1 text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- Internship location override model
alter table public.internships
  add column if not exists location_zip text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_source text not null default 'employer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_location_source_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_location_source_check
      check (location_source in ('employer', 'override'));
  end if;
end
$$;

-- Student location preference model (non-exact default)
alter table public.student_profiles
  add column if not exists preferred_city text,
  add column if not exists preferred_state text,
  add column if not exists preferred_zip text,
  add column if not exists max_commute_minutes int,
  add column if not exists transport_mode text,
  add column if not exists exact_address_line1 text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

update public.student_profiles
set max_commute_minutes = coalesce(max_commute_minutes, 30),
    transport_mode = coalesce(transport_mode, 'driving')
where max_commute_minutes is null
   or transport_mode is null;

alter table public.student_profiles
  alter column max_commute_minutes set default 30,
  alter column transport_mode set default 'driving';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_transport_mode_check'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_transport_mode_check
      check (transport_mode in ('driving', 'transit', 'walking', 'cycling'));
  end if;
end
$$;

create table if not exists public.commute_time_cache (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  internship_id uuid not null references public.internships(id) on delete cascade,
  transport_mode text not null,
  origin_hash text not null,
  destination_hash text not null,
  commute_minutes int not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists commute_time_cache_user_listing_mode_hash_uniq
  on public.commute_time_cache(user_id, internship_id, transport_mode, origin_hash, destination_hash);

create index if not exists commute_time_cache_user_expires_idx
  on public.commute_time_cache(user_id, expires_at desc);

alter table public.commute_time_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commute_time_cache' and policyname = 'commute_time_cache_select_own'
  ) then
    create policy commute_time_cache_select_own
      on public.commute_time_cache
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commute_time_cache' and policyname = 'commute_time_cache_insert_own'
  ) then
    create policy commute_time_cache_insert_own
      on public.commute_time_cache
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commute_time_cache' and policyname = 'commute_time_cache_update_own'
  ) then
    create policy commute_time_cache_update_own
      on public.commute_time_cache
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commute_time_cache' and policyname = 'commute_time_cache_delete_own'
  ) then
    create policy commute_time_cache_delete_own
      on public.commute_time_cache
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commute_time_cache' and policyname = 'commute_time_cache_admin_all'
  ) then
    create policy commute_time_cache_admin_all
      on public.commute_time_cache
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;
