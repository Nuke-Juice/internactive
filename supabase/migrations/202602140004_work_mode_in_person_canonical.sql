update public.internships
set work_mode = 'in_person'
where lower(coalesce(work_mode, '')) in ('on-site', 'onsite', 'in person');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'internships_work_mode_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships drop constraint internships_work_mode_check;
  end if;

  alter table public.internships
    add constraint internships_work_mode_check
    check (work_mode in ('remote', 'hybrid', 'in_person'));
end
$$;
