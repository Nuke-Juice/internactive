create table if not exists public.student_premium_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'free' check (status in ('free', 'trial', 'active', 'expired', 'canceled')),
  trial_started_at timestamptz null,
  trial_expires_at timestamptz null,
  active_since timestamptz null,
  current_period_end timestamptz null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_resume_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text null,
  mime_type text null,
  file_size integer null,
  uploaded_at timestamptz not null default now(),
  latest_version boolean not null default true
);

create table if not exists public.student_resume_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_file_id uuid null references public.student_resume_files(id) on delete set null,
  extracted_text text null,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'ok', 'failed')),
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'ok', 'failed')),
  resume_score integer null check (resume_score between 0 and 100),
  metrics jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_resume_files_user_latest_idx
  on public.student_resume_files (user_id, latest_version, uploaded_at desc);

create index if not exists student_resume_analysis_user_created_idx
  on public.student_resume_analysis (user_id, created_at desc);

create index if not exists student_premium_status_status_idx
  on public.student_premium_status (status);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_premium_status_updated_at on public.student_premium_status;
create trigger set_student_premium_status_updated_at
before update on public.student_premium_status
for each row
execute function public.set_row_updated_at();

drop trigger if exists set_student_resume_analysis_updated_at on public.student_resume_analysis;
create trigger set_student_resume_analysis_updated_at
before update on public.student_resume_analysis
for each row
execute function public.set_row_updated_at();

create or replace function public.ensure_student_premium_status_for_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'student' then
    insert into public.student_premium_status (user_id, status)
    values (new.id, 'free')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_student_premium_status_on_users on public.users;
create trigger ensure_student_premium_status_on_users
after insert or update of role on public.users
for each row
execute function public.ensure_student_premium_status_for_user();

insert into public.student_premium_status (user_id, status)
select u.id, 'free'
from public.users u
where u.role = 'student'
on conflict (user_id) do nothing;

alter table public.student_premium_status enable row level security;
alter table public.student_resume_files enable row level security;
alter table public.student_resume_analysis enable row level security;

drop policy if exists student_premium_status_select_access on public.student_premium_status;
create policy student_premium_status_select_access
  on public.student_premium_status
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_premium_status_insert_access on public.student_premium_status;
create policy student_premium_status_insert_access
  on public.student_premium_status
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_premium_status_update_access on public.student_premium_status;
create policy student_premium_status_update_access
  on public.student_premium_status
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_files_select_access on public.student_resume_files;
create policy student_resume_files_select_access
  on public.student_resume_files
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_files_insert_access on public.student_resume_files;
create policy student_resume_files_insert_access
  on public.student_resume_files
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_files_update_access on public.student_resume_files;
create policy student_resume_files_update_access
  on public.student_resume_files
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_analysis_select_access on public.student_resume_analysis;
create policy student_resume_analysis_select_access
  on public.student_resume_analysis
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_analysis_insert_access on public.student_resume_analysis;
create policy student_resume_analysis_insert_access
  on public.student_resume_analysis
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists student_resume_analysis_update_access on public.student_resume_analysis;
create policy student_resume_analysis_update_access
  on public.student_resume_analysis
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );
