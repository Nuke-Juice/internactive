create table if not exists public.stripe_customers (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text null,
  current_period_end timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);

alter table public.employer_profiles
  add column if not exists email_alerts_enabled boolean not null default false;

update public.employer_profiles ep
set email_alerts_enabled = true
from public.subscriptions s
where s.user_id = ep.user_id
  and s.status in ('active', 'trialing');

alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'stripe_customers' and policyname = 'stripe_customers_select_own'
  ) then
    create policy stripe_customers_select_own
      on public.stripe_customers
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'stripe_customers' and policyname = 'stripe_customers_insert_own'
  ) then
    create policy stripe_customers_insert_own
      on public.stripe_customers
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'stripe_customers' and policyname = 'stripe_customers_update_own'
  ) then
    create policy stripe_customers_update_own
      on public.stripe_customers
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_own'
  ) then
    create policy subscriptions_select_own
      on public.subscriptions
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;
