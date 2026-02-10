alter table public.employer_profiles
  add column if not exists avatar_url text;

alter table public.internships
  add column if not exists employer_verification_tier text not null default 'free';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'internships_employer_verification_tier_check'
      and conrelid = 'public.internships'::regclass
  ) then
    alter table public.internships
      add constraint internships_employer_verification_tier_check
      check (employer_verification_tier in ('free', 'starter', 'pro'));
  end if;
end
$$;

update public.internships
set employer_verification_tier = 'starter'
where employer_verification_tier = 'free'
  and employer_id in (
    select s.user_id
    from public.subscriptions s
    where s.status in ('active', 'trialing')
      and s.price_id is not null
      and s.price_id <> ''
  );

update public.internships
set employer_verification_tier = 'pro'
where employer_id in (
  select s.user_id
  from public.subscriptions s
  where s.status in ('active', 'trialing')
    and (
      lower(coalesce(s.price_id, '')) like '%pro%'
      or lower(coalesce(s.price_id, '')) like '%growth%'
    )
);
