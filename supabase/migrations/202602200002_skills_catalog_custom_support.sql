-- Skills system audit notes:
-- - Canonical catalog currently lives in public.skills and public.skill_aliases.
-- - Student canonical links currently live in public.student_skill_items.
-- - Internship canonical links currently live in public.internship_required_skill_items and public.internship_preferred_skill_items.
-- - Matching consumes canonical IDs first (lib/matching.ts), then falls back to free-text skill tokens.

create table if not exists public.canonical_skill_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.skills
  add column if not exists category_id uuid references public.canonical_skill_categories(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.canonical_skill_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  canonical_skill_id uuid not null references public.skills(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_skills (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('student', 'employer')),
  owner_id uuid not null,
  name text not null,
  normalized_name text not null,
  mapped_skill_id uuid null references public.skills(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_type, owner_id, normalized_name)
);

create table if not exists public.student_profile_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  canonical_skill_id uuid null references public.skills(id) on delete cascade,
  custom_skill_id uuid null references public.custom_skills(id) on delete cascade,
  source text not null check (source in ('canonical', 'custom')),
  created_at timestamptz not null default now(),
  unique (student_id, canonical_skill_id),
  unique (student_id, custom_skill_id),
  check (((canonical_skill_id is not null)::int + (custom_skill_id is not null)::int) = 1)
);

create table if not exists public.internship_skill_requirements (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships(id) on delete cascade,
  canonical_skill_id uuid null references public.skills(id) on delete cascade,
  custom_skill_id uuid null references public.custom_skills(id) on delete cascade,
  importance text not null check (importance in ('required', 'preferred')),
  source text not null check (source in ('canonical', 'custom')),
  created_at timestamptz not null default now(),
  unique (internship_id, canonical_skill_id, importance),
  unique (internship_id, custom_skill_id, importance),
  check (((canonical_skill_id is not null)::int + (custom_skill_id is not null)::int) = 1)
);

create index if not exists custom_skills_owner_idx
  on public.custom_skills(owner_type, owner_id);
create index if not exists custom_skills_normalized_name_idx
  on public.custom_skills(normalized_name);
create index if not exists custom_skills_mapped_skill_id_idx
  on public.custom_skills(mapped_skill_id);
create index if not exists student_profile_skills_student_id_idx
  on public.student_profile_skills(student_id);
create index if not exists student_profile_skills_canonical_skill_id_idx
  on public.student_profile_skills(canonical_skill_id);
create index if not exists student_profile_skills_custom_skill_id_idx
  on public.student_profile_skills(custom_skill_id);
create index if not exists internship_skill_requirements_internship_id_idx
  on public.internship_skill_requirements(internship_id);
create index if not exists internship_skill_requirements_canonical_skill_id_idx
  on public.internship_skill_requirements(canonical_skill_id);
create index if not exists internship_skill_requirements_custom_skill_id_idx
  on public.internship_skill_requirements(custom_skill_id);
create index if not exists internship_skill_requirements_importance_idx
  on public.internship_skill_requirements(importance);

alter table public.canonical_skill_categories enable row level security;
alter table public.canonical_skill_aliases enable row level security;
alter table public.custom_skills enable row level security;
alter table public.student_profile_skills enable row level security;
alter table public.internship_skill_requirements enable row level security;

-- Backfill a category row per legacy text category and link skills.
insert into public.canonical_skill_categories (slug, name)
select distinct
  lower(regexp_replace(trim(s.category), '[^a-z0-9]+', '-', 'g')) as slug,
  trim(s.category) as name
from public.skills s
where trim(coalesce(s.category, '')) <> ''
on conflict (slug) do update
set name = excluded.name;

update public.skills s
set category_id = c.id,
    updated_at = now()
from public.canonical_skill_categories c
where s.category_id is null
  and trim(coalesce(s.category, '')) <> ''
  and c.slug = lower(regexp_replace(trim(s.category), '[^a-z0-9]+', '-', 'g'));

-- Keep canonical_skill_aliases in sync with existing skill_aliases.
insert into public.canonical_skill_aliases (alias, canonical_skill_id)
select alias, skill_id
from public.skill_aliases
on conflict (alias) do update
set canonical_skill_id = excluded.canonical_skill_id;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'canonical_skill_categories' and policyname = 'canonical_skill_categories_select_public'
  ) then
    create policy canonical_skill_categories_select_public
      on public.canonical_skill_categories
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'canonical_skill_categories' and policyname = 'canonical_skill_categories_manage_admin'
  ) then
    create policy canonical_skill_categories_manage_admin
      on public.canonical_skill_categories
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'canonical_skill_aliases' and policyname = 'canonical_skill_aliases_select_public'
  ) then
    create policy canonical_skill_aliases_select_public
      on public.canonical_skill_aliases
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'canonical_skill_aliases' and policyname = 'canonical_skill_aliases_manage_admin'
  ) then
    create policy canonical_skill_aliases_manage_admin
      on public.canonical_skill_aliases
      for all
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'custom_skills' and policyname = 'custom_skills_select_own'
  ) then
    create policy custom_skills_select_own
      on public.custom_skills
      for select
      to authenticated
      using (
        public.is_admin_user(auth.uid())
        or (
          owner_type = 'student' and owner_id = auth.uid()
        )
        or (
          owner_type = 'employer' and owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'custom_skills' and policyname = 'custom_skills_insert_own'
  ) then
    create policy custom_skills_insert_own
      on public.custom_skills
      for insert
      to authenticated
      with check (
        public.is_admin_user(auth.uid())
        or (
          owner_type = 'student' and owner_id = auth.uid()
        )
        or (
          owner_type = 'employer' and owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'custom_skills' and policyname = 'custom_skills_update_own'
  ) then
    create policy custom_skills_update_own
      on public.custom_skills
      for update
      to authenticated
      using (
        public.is_admin_user(auth.uid())
        or (
          owner_type = 'student' and owner_id = auth.uid()
        )
        or (
          owner_type = 'employer' and owner_id = auth.uid()
        )
      )
      with check (
        public.is_admin_user(auth.uid())
        or (
          owner_type = 'student' and owner_id = auth.uid()
        )
        or (
          owner_type = 'employer' and owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_profile_skills' and policyname = 'student_profile_skills_select_own'
  ) then
    create policy student_profile_skills_select_own
      on public.student_profile_skills
      for select
      to authenticated
      using (public.is_admin_user(auth.uid()) or student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_profile_skills' and policyname = 'student_profile_skills_insert_own'
  ) then
    create policy student_profile_skills_insert_own
      on public.student_profile_skills
      for insert
      to authenticated
      with check (public.is_admin_user(auth.uid()) or student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'student_profile_skills' and policyname = 'student_profile_skills_delete_own'
  ) then
    create policy student_profile_skills_delete_own
      on public.student_profile_skills
      for delete
      to authenticated
      using (public.is_admin_user(auth.uid()) or student_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_skill_requirements' and policyname = 'internship_skill_requirements_select_public'
  ) then
    create policy internship_skill_requirements_select_public
      on public.internship_skill_requirements
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'internship_skill_requirements' and policyname = 'internship_skill_requirements_manage_employer'
  ) then
    create policy internship_skill_requirements_manage_employer
      on public.internship_skill_requirements
      for all
      to authenticated
      using (
        public.is_admin_user(auth.uid())
        or exists (
          select 1
          from public.internships i
          where i.id = internship_skill_requirements.internship_id
            and i.employer_id = auth.uid()
        )
      )
      with check (
        public.is_admin_user(auth.uid())
        or exists (
          select 1
          from public.internships i
          where i.id = internship_skill_requirements.internship_id
            and i.employer_id = auth.uid()
        )
      );
  end if;
end
$$;
