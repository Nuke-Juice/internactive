alter table public.internships
  add column if not exists recommended_coursework text[] default '{}'::text[];
