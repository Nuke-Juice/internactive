alter table public.employer_profiles
  add column if not exists contact_email text;

create table if not exists public.employer_claim_tokens (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid null references public.internships(id) on delete set null,
  employer_id uuid not null references public.users(id) on delete cascade,
  contact_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz null,
  used_by uuid null references public.users(id) on delete set null,
  sent_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists employer_claim_tokens_employer_id_idx
  on public.employer_claim_tokens(employer_id);
create index if not exists employer_claim_tokens_expires_at_idx
  on public.employer_claim_tokens(expires_at);

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

alter table public.employer_claim_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employer_claim_tokens'
      and policyname = 'employer_claim_tokens_select_admin'
  ) then
    create policy employer_claim_tokens_select_admin
      on public.employer_claim_tokens
      for select
      to authenticated
      using (public.is_admin_user(auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employer_claim_tokens'
      and policyname = 'employer_claim_tokens_insert_admin'
  ) then
    create policy employer_claim_tokens_insert_admin
      on public.employer_claim_tokens
      for insert
      to authenticated
      with check (public.is_admin_user(auth.uid()));
  end if;
end
$$;
