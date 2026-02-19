alter table public.employer_profiles
  add column if not exists company_size text,
  add column if not exists internship_types text,
  add column if not exists typical_internship_duration text;
