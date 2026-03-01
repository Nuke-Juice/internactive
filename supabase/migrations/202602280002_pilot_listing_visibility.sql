alter table public.internships
  add column if not exists is_pilot_listing boolean not null default true,
  add column if not exists visibility text not null default 'admin_only';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_visibility_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_visibility_check
      check (visibility in ('admin_only', 'public_browse'));
  end if;
end
$$;

update public.internships
set
  is_pilot_listing = true,
  visibility = case
    when is_active = true or lower(coalesce(status, '')) = 'published' then 'public_browse'
    else 'admin_only'
  end
where coalesce(is_pilot_listing, true) = true;
