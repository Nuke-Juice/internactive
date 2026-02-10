alter table public.internships
  add column if not exists target_graduation_years text[] default '{}'::text[];
