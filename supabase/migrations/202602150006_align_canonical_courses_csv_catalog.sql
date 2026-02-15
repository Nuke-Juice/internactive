-- Align canonical_courses with CSV-imported catalog shape while preserving legacy fields.

alter table if exists public.canonical_courses
  add column if not exists subject_code text,
  add column if not exists course_number text,
  add column if not exists title text,
  add column if not exists institution text,
  add column if not exists category text,
  add column if not exists slug text;

-- Keep slug unique for deterministic upserts from CSV imports.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'canonical_courses_slug_key'
      and conrelid = 'public.canonical_courses'::regclass
  ) then
    alter table public.canonical_courses
      add constraint canonical_courses_slug_key unique (slug);
  end if;
end
$$;

-- Legacy schema had unique(code, category_id). CSV import uses slug identity.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'canonical_courses_code_category_id_key'
      and conrelid = 'public.canonical_courses'::regclass
  ) then
    alter table public.canonical_courses
      drop constraint canonical_courses_code_category_id_key;
  end if;
end
$$;

create index if not exists canonical_courses_subject_code_idx
  on public.canonical_courses (subject_code);

create index if not exists canonical_courses_course_number_idx
  on public.canonical_courses (course_number);

create index if not exists canonical_courses_institution_idx
  on public.canonical_courses (institution);

create index if not exists canonical_courses_slug_idx
  on public.canonical_courses (slug);
