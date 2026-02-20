alter table public.users
  add column if not exists last_seen_at timestamptz;

create index if not exists users_role_last_seen_at_idx
  on public.users (role, last_seen_at desc);
