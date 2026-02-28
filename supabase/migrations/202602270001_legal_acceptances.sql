create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup'
);

create unique index if not exists legal_acceptances_user_versions_source_idx
  on public.legal_acceptances(user_id, terms_version, privacy_version, source);

create index if not exists legal_acceptances_user_accepted_at_idx
  on public.legal_acceptances(user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists legal_acceptances_select_own on public.legal_acceptances;
create policy legal_acceptances_select_own
  on public.legal_acceptances
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );

drop policy if exists legal_acceptances_insert_own on public.legal_acceptances;
create policy legal_acceptances_insert_own
  on public.legal_acceptances
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    or public.is_admin_user((select auth.uid()))
  );
