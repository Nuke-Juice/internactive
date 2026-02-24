alter table public.internships
  add column if not exists employment_type text,
  add column if not exists internship_types text[] not null default '{}'::text[],
  add column if not exists work_authorization_scope text,
  add column if not exists compensation_currency text not null default 'USD',
  add column if not exists compensation_interval text not null default 'hour',
  add column if not exists compensation_is_estimated boolean not null default false,
  add column if not exists bonus_eligible boolean,
  add column if not exists compensation_notes text,
  add column if not exists requirements_details jsonb not null default '{}'::jsonb,
  add column if not exists compliance_details jsonb not null default '{}'::jsonb,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists description_raw text;

do $$
begin
  alter table public.internships
    drop constraint if exists internships_employment_type_check;
  alter table public.internships
    add constraint internships_employment_type_check
    check (employment_type is null or employment_type in ('full_time', 'part_time', 'contract', 'temporary', 'internship'));

  alter table public.internships
    drop constraint if exists internships_compensation_currency_check;
  alter table public.internships
    add constraint internships_compensation_currency_check
    check (compensation_currency ~ '^[A-Z]{3}$');

  alter table public.internships
    drop constraint if exists internships_compensation_interval_check;
  alter table public.internships
    add constraint internships_compensation_interval_check
    check (compensation_interval in ('hour', 'week', 'month', 'year'));

  alter table public.internships
    drop constraint if exists internships_requirements_details_check;
  alter table public.internships
    add constraint internships_requirements_details_check
    check (jsonb_typeof(requirements_details) = 'object');

  alter table public.internships
    drop constraint if exists internships_compliance_details_check;
  alter table public.internships
    add constraint internships_compliance_details_check
    check (jsonb_typeof(compliance_details) = 'object');

  alter table public.internships
    drop constraint if exists internships_source_metadata_check;
  alter table public.internships
    add constraint internships_source_metadata_check
    check (jsonb_typeof(source_metadata) = 'object');
end
$$;
