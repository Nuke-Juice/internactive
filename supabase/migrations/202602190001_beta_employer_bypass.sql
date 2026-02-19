alter table public.employer_profiles
  add column if not exists is_beta_employer boolean not null default false;

create or replace function public.enforce_employer_beta_update_admin_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_role text := (select auth.role());
begin
  if new.is_beta_employer is not distinct from old.is_beta_employer then
    return new;
  end if;

  if actor_role = 'service_role' then
    return new;
  end if;

  if actor_uid is null or not public.is_admin_user(actor_uid) then
    raise exception 'Only admins can update is_beta_employer'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_employer_profiles_beta_admin_only on public.employer_profiles;
create trigger trg_employer_profiles_beta_admin_only
before update on public.employer_profiles
for each row
execute function public.enforce_employer_beta_update_admin_only();
