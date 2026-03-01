alter table public.student_profiles
  add column if not exists concierge_opt_in boolean not null default false,
  add column if not exists concierge_intake_answers jsonb not null default '{}'::jsonb,
  add column if not exists concierge_intake_completed_at timestamptz,
  add column if not exists concierge_score smallint,
  add column if not exists concierge_tags text[] not null default '{}'::text[],
  add column if not exists concierge_notes text,
  add column if not exists pilot_screening_answers jsonb not null default '{}'::jsonb,
  add column if not exists pilot_screening_completed_at timestamptz,
  add column if not exists pilot_screening_score smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_pilot_screening_score_check'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_pilot_screening_score_check
      check (
        pilot_screening_score is null
        or (pilot_screening_score between 0 and 10)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_concierge_score_check'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_concierge_score_check
      check (
        concierge_score is null
        or (concierge_score between 0 and 10)
      );
  end if;
end
$$;

update public.student_profiles
set
  concierge_opt_in = true,
  concierge_intake_answers = case
    when coalesce(jsonb_typeof(pilot_screening_answers), 'null') = 'object' then pilot_screening_answers
    else '{}'::jsonb
  end,
  concierge_intake_completed_at = pilot_screening_completed_at,
  concierge_score = pilot_screening_score
where concierge_intake_completed_at is null
  and (
    pilot_screening_completed_at is not null
    or pilot_screening_score is not null
    or pilot_screening_answers <> '{}'::jsonb
  );

alter table public.applications
  add column if not exists pilot_stage text not null default 'new',
  add column if not exists pilot_score smallint,
  add column if not exists pilot_tags text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_pilot_stage_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_pilot_stage_check
      check (
        pilot_stage in (
          'new',
          'screened',
          'shortlist',
          'introduced',
          'interviewing',
          'hired',
          'rejected'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_pilot_score_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_pilot_score_check
      check (
        pilot_score is null
        or (pilot_score between 0 and 10)
      );
  end if;
end
$$;

create index if not exists applications_pilot_stage_created_at_idx
  on public.applications (pilot_stage, created_at desc);

create index if not exists applications_internship_pilot_stage_score_idx
  on public.applications (internship_id, pilot_stage, pilot_score desc, submitted_at desc);
