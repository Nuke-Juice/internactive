alter table public.internships
  add column if not exists is_active boolean not null default true,
  add column if not exists source text not null default 'employer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_source_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_source_check
      check (source in ('concierge', 'employer'));
  end if;
end
$$;

update public.internships
set source = 'employer'
where source is null or source not in ('concierge', 'employer');
