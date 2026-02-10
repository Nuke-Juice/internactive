alter table public.employer_profiles
  add column if not exists overview text,
  add column if not exists header_image_url text;
