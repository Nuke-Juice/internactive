alter table public.internships
  add column if not exists category text,
  add column if not exists remote_allowed boolean not null default false,
  add column if not exists pay_min_hourly numeric,
  add column if not exists pay_max_hourly numeric,
  add column if not exists hours_per_week_min integer,
  add column if not exists hours_per_week_max integer,
  add column if not exists responsibilities text[],
  add column if not exists qualifications text[],
  add column if not exists apply_deadline date,
  add column if not exists admin_notes text,
  add column if not exists template_used text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'internships_source_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_source_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_source_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_source_check
      check (source in ('concierge', 'employer_self', 'partner'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_category_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_category_check
      check (
        category is null
        or category in ('Finance', 'Accounting', 'Data', 'Marketing', 'Operations', 'Product', 'Design', 'Sales', 'HR', 'Engineering')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_experience_level_enum_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_experience_level_enum_check
      check (
        experience_level is null
        or experience_level in ('entry', 'mid', 'senior')
      );
  end if;
end
$$;

update public.internships
set source = 'employer_self'
where source = 'employer';

alter table public.internships
  alter column source set default 'employer_self';
