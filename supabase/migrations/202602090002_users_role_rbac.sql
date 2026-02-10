do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum (
      'super_admin',
      'ops_admin',
      'support',
      'employer',
      'student'
    );
  end if;
end
$$;

alter table public.users
  add column if not exists role public.user_role;
