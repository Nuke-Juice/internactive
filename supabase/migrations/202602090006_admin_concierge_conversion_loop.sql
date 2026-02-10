alter table public.employer_profiles
  add column if not exists contact_email text;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  employer_id uuid not null references public.users(id) on delete cascade,
  sent_to text not null,
  sent_by uuid not null references public.users(id) on delete cascade,
  action_type text not null default 'send_employer_summary',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_internship_created_idx
  on public.admin_actions(internship_id, created_at desc);
create index if not exists admin_actions_employer_created_idx
  on public.admin_actions(employer_id, created_at desc);

create or replace function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and u.role in ('ops_admin', 'super_admin')
  );
$$;

alter table public.admin_actions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'applications'
      and policyname = 'applications_select_admin_all'
  ) then
    create policy applications_select_admin_all
      on public.applications
      for select
      to authenticated
      using (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_actions'
      and policyname = 'admin_actions_select_admin'
  ) then
    create policy admin_actions_select_admin
      on public.admin_actions
      for select
      to authenticated
      using (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_actions'
      and policyname = 'admin_actions_insert_admin'
  ) then
    create policy admin_actions_insert_admin
      on public.admin_actions
      for insert
      to authenticated
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;
