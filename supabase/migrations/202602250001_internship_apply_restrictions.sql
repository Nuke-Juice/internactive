alter table public.internships
  add column if not exists restrict_by_major boolean not null default false,
  add column if not exists restrict_by_year boolean not null default false;
