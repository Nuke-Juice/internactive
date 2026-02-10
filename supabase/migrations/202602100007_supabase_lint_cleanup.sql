-- Resolve Supabase lint warnings:
-- 1) auth_rls_initplan: wrap auth.* calls in subselect form
-- 2) multiple_permissive_policies: consolidate/remove overlapping permissive policies
-- 3) duplicate_index: drop redundant duplicate indexes/constraints

-- ---------------------------------------------------------------------------
-- 1) Rewrite policy expressions that directly call auth.uid()/auth.role().
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
  using_expr text;
  check_expr text;
  roles_sql text;
  stmt text;
begin
  for rec in
    select
      schemaname,
      tablename,
      policyname,
      cmd,
      coalesce(
        (
          select string_agg(quote_ident(role_name), ', ')
          from unnest(roles) as role_name
        ),
        'public'
      ) as roles_sql,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual is not null and (qual like '%auth.uid()%' or qual like '%auth.role()%'))
        or (with_check is not null and (with_check like '%auth.uid()%' or with_check like '%auth.role()%'))
      )
  loop
    using_expr := case
      when rec.qual is null then null
      else replace(replace(rec.qual, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())')
    end;

    check_expr := case
      when rec.with_check is null then null
      else replace(replace(rec.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())')
    end;

    roles_sql := rec.roles_sql;

    stmt := format(
      'alter policy %I on %I.%I to %s%s%s',
      rec.policyname,
      rec.schemaname,
      rec.tablename,
      roles_sql,
      case when using_expr is not null then format(' using (%s)', using_expr) else '' end,
      case when check_expr is not null then format(' with check (%s)', check_expr) else '' end
    );

    execute stmt;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Consolidate overlapping permissive policies.
-- ---------------------------------------------------------------------------

-- applications: merge 3 authenticated SELECT policies into one.
drop policy if exists applications_select_student_own on public.applications;
drop policy if exists applications_select_employer_internships on public.applications;
drop policy if exists applications_select_admin_all on public.applications;

create policy applications_select_authenticated
  on public.applications
  for select
  to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

-- commute_time_cache: merge own/admin policies by command.
drop policy if exists commute_time_cache_select_own on public.commute_time_cache;
drop policy if exists commute_time_cache_insert_own on public.commute_time_cache;
drop policy if exists commute_time_cache_update_own on public.commute_time_cache;
drop policy if exists commute_time_cache_delete_own on public.commute_time_cache;
drop policy if exists commute_time_cache_admin_all on public.commute_time_cache;

create policy commute_time_cache_select_access
  on public.commute_time_cache
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

create policy commute_time_cache_insert_access
  on public.commute_time_cache
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

create policy commute_time_cache_update_access
  on public.commute_time_cache
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

create policy commute_time_cache_delete_access
  on public.commute_time_cache
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

-- users: keep one authenticated SELECT/UPDATE policy.
drop policy if exists users_read_own_row on public.users;
drop policy if exists users_select_self on public.users;
drop policy if exists users_update_self on public.users;

-- employer_profiles: keep one authenticated SELECT/UPDATE policy.
drop policy if exists employer_profiles_select_self on public.employer_profiles;
drop policy if exists employer_profiles_update_self on public.employer_profiles;

-- student_profiles: keep one authenticated SELECT/UPDATE/INSERT policy.
drop policy if exists read_own_student_profile on public.student_profiles;
drop policy if exists insert_own_student_profile on public.student_profiles;
drop policy if exists update_own_student_profile on public.student_profiles;

-- courses: keep one authenticated SELECT policy.
drop policy if exists courses_select_authenticated on public.courses;
drop policy if exists read_courses on public.courses;

create policy courses_select_authenticated
  on public.courses
  for select
  to authenticated
  using (true);

-- universities: keep one authenticated SELECT policy.
drop policy if exists universities_select_authenticated on public.universities;
drop policy if exists read_universities on public.universities;

create policy universities_select_authenticated
  on public.universities
  for select
  to authenticated
  using (true);

-- coursework_categories: split admin manage policy into write-only commands.
drop policy if exists coursework_categories_manage_admin on public.coursework_categories;

create policy coursework_categories_insert_admin
  on public.coursework_categories
  for insert
  to authenticated
  with check (public.is_admin_user((select auth.uid())));

create policy coursework_categories_update_admin
  on public.coursework_categories
  for update
  to authenticated
  using (public.is_admin_user((select auth.uid())))
  with check (public.is_admin_user((select auth.uid())));

create policy coursework_categories_delete_admin
  on public.coursework_categories
  for delete
  to authenticated
  using (public.is_admin_user((select auth.uid())));

-- coursework_item_category_map: split admin manage policy into write-only commands.
drop policy if exists coursework_item_category_map_manage_admin on public.coursework_item_category_map;

create policy coursework_item_category_map_insert_admin
  on public.coursework_item_category_map
  for insert
  to authenticated
  with check (public.is_admin_user((select auth.uid())));

create policy coursework_item_category_map_update_admin
  on public.coursework_item_category_map
  for update
  to authenticated
  using (public.is_admin_user((select auth.uid())))
  with check (public.is_admin_user((select auth.uid())));

create policy coursework_item_category_map_delete_admin
  on public.coursework_item_category_map
  for delete
  to authenticated
  using (public.is_admin_user((select auth.uid())));

-- internship_coursework_items: combine employer/admin insert+delete; keep public select.
drop policy if exists internship_coursework_items_insert_employer on public.internship_coursework_items;
drop policy if exists internship_coursework_items_delete_employer on public.internship_coursework_items;
drop policy if exists internship_coursework_items_manage_admin on public.internship_coursework_items;

create policy internship_coursework_items_insert_access
  on public.internship_coursework_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

create policy internship_coursework_items_delete_access
  on public.internship_coursework_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

-- internship_coursework_category_links: combine employer/admin insert+delete; keep public select.
drop policy if exists internship_coursework_category_links_insert_employer on public.internship_coursework_category_links;
drop policy if exists internship_coursework_category_links_delete_employer on public.internship_coursework_category_links;
drop policy if exists internship_coursework_category_links_manage_admin on public.internship_coursework_category_links;

create policy internship_coursework_category_links_insert_access
  on public.internship_coursework_category_links
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

create policy internship_coursework_category_links_delete_access
  on public.internship_coursework_category_links
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.internships i
      where i.id = internship_id
        and i.employer_id = (select auth.uid())
    )
    or public.is_admin_user((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 3) Drop duplicate indexes/constraints.
-- ---------------------------------------------------------------------------

drop index if exists public.idx_courses_university_code;
drop index if exists public.idx_courses_search_trgm;

alter table public.student_profiles
  drop constraint if exists student_profiles_user_id_key;
