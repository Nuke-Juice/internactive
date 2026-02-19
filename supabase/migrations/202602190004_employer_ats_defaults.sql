create table if not exists public.employer_settings (
  employer_id uuid primary key references public.users(id) on delete cascade,
  default_ats_stage_mode text not null default 'none'
    check (default_ats_stage_mode in ('none', 'curated', 'immediate')),
  default_external_apply_url text,
  default_external_apply_type text not null default 'new_tab'
    check (default_external_apply_type in ('new_tab', 'redirect')),
  default_external_apply_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internships
  add column if not exists use_employer_ats_defaults boolean not null default true;

alter table public.employer_settings enable row level security;

drop policy if exists employer_settings_select_access on public.employer_settings;
create policy employer_settings_select_access
  on public.employer_settings
  for select
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_settings_insert_access on public.employer_settings;
create policy employer_settings_insert_access
  on public.employer_settings
  for insert
  to authenticated
  with check (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_settings_update_access on public.employer_settings;
create policy employer_settings_update_access
  on public.employer_settings
  for update
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists employer_settings_delete_access on public.employer_settings;
create policy employer_settings_delete_access
  on public.employer_settings
  for delete
  to authenticated
  using (
    employer_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop trigger if exists set_employer_settings_updated_at on public.employer_settings;
create trigger set_employer_settings_updated_at
before update on public.employer_settings
for each row
execute function public.set_row_updated_at();
