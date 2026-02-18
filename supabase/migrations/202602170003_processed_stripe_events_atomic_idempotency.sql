create table if not exists public.processed_stripe_events (
  event_id text primary key,
  received_at timestamptz not null default now(),
  event_type text not null,
  status text not null default 'done',
  constraint processed_stripe_events_status_check
    check (status in ('processing', 'done', 'failed'))
);

create index if not exists processed_stripe_events_received_at_idx
  on public.processed_stripe_events (received_at desc);

alter table public.processed_stripe_events enable row level security;

drop policy if exists processed_stripe_events_select_admin on public.processed_stripe_events;
create policy processed_stripe_events_select_admin
  on public.processed_stripe_events
  for select
  to authenticated
  using (public.is_admin_user((select auth.uid())));
