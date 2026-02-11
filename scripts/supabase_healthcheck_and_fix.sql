-- Run in Supabase SQL Editor (production) once.
-- Purpose:
-- 1) Validate key constraints/policies are present.
-- 2) Auto-fix the most critical drift points idempotently.

begin;

-- ---------------------------------------------------------------------------
-- Auto-fix: enforce one application per student per internship.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    id,
    row_number() over (
      partition by student_id, internship_id
      order by created_at asc nulls last, id asc
    ) as row_num
  from public.applications
)
delete from public.applications a
using ranked r
where a.id = r.id
  and r.row_num > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_student_id_internship_id_key'
  ) then
    alter table public.applications
      add constraint applications_student_id_internship_id_key
      unique (student_id, internship_id);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Auto-fix: ensure RLS is enabled on core tables.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.internships enable row level security;
alter table public.applications enable row level security;
alter table public.analytics_events enable row level security;
alter table public.commute_time_cache enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Checks: report health snapshot.
-- ---------------------------------------------------------------------------

-- Check 1: required typed-array columns on internships/student_profiles.
select
  table_name,
  column_name,
  udt_name as postgres_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'internships' and column_name in (
      'majors',
      'coursework',
      'target_graduation_years',
      'required_skills',
      'preferred_skills',
      'responsibilities',
      'qualifications',
      'recommended_coursework'
    ))
    or
    (table_name = 'student_profiles' and column_name in ('majors', 'coursework'))
  )
order by table_name, column_name;

-- Check 2: critical internship constraints.
select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.internships'::regclass
  and conname in (
    'internships_source_check',
    'internships_term_required_check',
    'internships_application_deadline_today_or_future_check',
    'internships_location_source_check'
  )
order by conname;

-- Check 3: unique application constraint exists.
select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.applications'::regclass
  and conname = 'applications_student_id_internship_id_key';

-- Check 4: RLS enabled state for key tables.
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'users',
    'student_profiles',
    'employer_profiles',
    'internships',
    'applications',
    'analytics_events',
    'commute_time_cache',
    'stripe_customers',
    'subscriptions'
  )
order by tablename;

-- Check 5: policy count by table (quick sanity).
select
  tablename,
  count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;

commit;
