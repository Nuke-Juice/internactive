alter table public.student_profiles
  add column if not exists second_major_id uuid,
  add column if not exists coursework_unverified text[];

create index if not exists student_profiles_second_major_id_idx on public.student_profiles (second_major_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_profiles_second_major_id_fkey'
      and conrelid = 'public.student_profiles'::regclass
  ) then
    alter table public.student_profiles
      add constraint student_profiles_second_major_id_fkey
      foreign key (second_major_id)
      references public.canonical_majors(id)
      on delete set null;
  end if;
end
$$;
