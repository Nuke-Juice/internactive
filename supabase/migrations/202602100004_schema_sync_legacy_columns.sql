alter table public.internships
  add column if not exists location_zip text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_source text;

alter table public.internships
  alter column location_source set default 'employer';

update public.internships
set location_source = 'employer'
where location_source is null;

alter table public.employer_profiles
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_zip text,
  add column if not exists location_address_line1 text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists overview text,
  add column if not exists header_image_url text;
