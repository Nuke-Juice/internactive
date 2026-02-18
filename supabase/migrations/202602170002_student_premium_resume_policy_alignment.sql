create unique index if not exists student_resume_files_one_latest_per_user
  on public.student_resume_files (user_id)
  where latest_version = true;

alter table public.student_premium_status enable row level security;
alter table public.student_resume_files enable row level security;
alter table public.student_resume_analysis enable row level security;

drop policy if exists student_premium_status_select_access on public.student_premium_status;
create policy student_premium_status_select_access
  on public.student_premium_status
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists student_premium_status_insert_access on public.student_premium_status;
create policy student_premium_status_insert_access
  on public.student_premium_status
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists student_premium_status_update_access on public.student_premium_status;
create policy student_premium_status_update_access
  on public.student_premium_status
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists student_resume_files_select_access on public.student_resume_files;
create policy student_resume_files_select_access
  on public.student_resume_files
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists student_resume_files_insert_access on public.student_resume_files;
create policy student_resume_files_insert_access
  on public.student_resume_files
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists student_resume_files_update_access on public.student_resume_files;
create policy student_resume_files_update_access
  on public.student_resume_files
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists student_resume_analysis_select_access on public.student_resume_analysis;
create policy student_resume_analysis_select_access
  on public.student_resume_analysis
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists student_resume_analysis_insert_access on public.student_resume_analysis;
create policy student_resume_analysis_insert_access
  on public.student_resume_analysis
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists student_resume_analysis_update_access on public.student_resume_analysis;
create policy student_resume_analysis_update_access
  on public.student_resume_analysis
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
