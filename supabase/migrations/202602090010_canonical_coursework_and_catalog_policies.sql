alter table public.skills
  add column if not exists normalized_name text;

update public.skills
set normalized_name = coalesce(
  normalized_name,
  nullif(slug, ''),
  lower(regexp_replace(label, '[^a-z0-9]+', '', 'g'))
)
where normalized_name is null;

create unique index if not exists skills_normalized_name_uidx
  on public.skills(normalized_name);

create table if not exists public.coursework_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.student_coursework_items (
  student_id uuid not null references public.users(id) on delete cascade,
  coursework_item_id uuid not null references public.coursework_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, coursework_item_id)
);

create table if not exists public.internship_coursework_items (
  internship_id uuid not null references public.internships(id) on delete cascade,
  coursework_item_id uuid not null references public.coursework_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (internship_id, coursework_item_id)
);

create index if not exists student_coursework_items_coursework_item_id_idx
  on public.student_coursework_items(coursework_item_id);

create index if not exists internship_coursework_items_coursework_item_id_idx
  on public.internship_coursework_items(coursework_item_id);

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

alter table public.coursework_items enable row level security;
alter table public.student_coursework_items enable row level security;
alter table public.internship_coursework_items enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'skills' and policyname = 'skills_insert_admin'
  ) then
    create policy skills_insert_admin
      on public.skills
      for insert
      to authenticated
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'coursework_items' and policyname = 'coursework_items_select_public'
  ) then
    create policy coursework_items_select_public
      on public.coursework_items
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'coursework_items' and policyname = 'coursework_items_insert_admin'
  ) then
    create policy coursework_items_insert_admin
      on public.coursework_items
      for insert
      to authenticated
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_coursework_items' and policyname = 'student_coursework_items_select_own'
  ) then
    create policy student_coursework_items_select_own
      on public.student_coursework_items
      for select
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_coursework_items' and policyname = 'student_coursework_items_insert_own'
  ) then
    create policy student_coursework_items_insert_own
      on public.student_coursework_items
      for insert
      to authenticated
      with check (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_coursework_items' and policyname = 'student_coursework_items_delete_own'
  ) then
    create policy student_coursework_items_delete_own
      on public.student_coursework_items
      for delete
      to authenticated
      using (student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_coursework_items' and policyname = 'internship_coursework_items_select_public'
  ) then
    create policy internship_coursework_items_select_public
      on public.internship_coursework_items
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_coursework_items' and policyname = 'internship_coursework_items_insert_employer'
  ) then
    create policy internship_coursework_items_insert_employer
      on public.internship_coursework_items
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.internships i
          where i.id = internship_coursework_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_coursework_items' and policyname = 'internship_coursework_items_delete_employer'
  ) then
    create policy internship_coursework_items_delete_employer
      on public.internship_coursework_items
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.internships i
          where i.id = internship_coursework_items.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_coursework_items' and policyname = 'internship_coursework_items_manage_admin'
  ) then
    create policy internship_coursework_items_manage_admin
      on public.internship_coursework_items
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;
