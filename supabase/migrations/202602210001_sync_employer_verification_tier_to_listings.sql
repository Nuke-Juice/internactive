create or replace function public.resolve_employer_listing_verification_tier(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when exists (
        select 1
        from public.employer_profiles ep
        where ep.user_id = target_user_id
          and (
            coalesce(ep.is_beta_employer, false)
            or coalesce(ep.verified_employer_manual_override, false)
            or coalesce(ep.verified_employer, false)
          )
      ) then 'pro'
      when exists (
        select 1
        from public.subscriptions s
        where s.user_id = target_user_id
          and s.status in ('active', 'trialing')
          and (
            lower(coalesce(s.price_id, '')) like '%pro%'
            or lower(coalesce(s.price_id, '')) like '%growth%'
          )
      ) then 'pro'
      else 'free'
    end;
$$;

create or replace function public.sync_employer_listing_verification_tier(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_tier text;
begin
  if target_user_id is null then
    return;
  end if;

  next_tier := public.resolve_employer_listing_verification_tier(target_user_id);

  update public.internships
  set employer_verification_tier = next_tier
  where employer_id = target_user_id
    and employer_verification_tier is distinct from next_tier;
end;
$$;

create or replace function public.trg_sync_employer_listing_verification_tier_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_employer_listing_verification_tier(new.user_id);
  return new;
end;
$$;

create or replace function public.trg_sync_employer_listing_verification_tier_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := coalesce(new.user_id, old.user_id);
  perform public.sync_employer_listing_verification_tier(target_user_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_employer_listing_verification_tier_profile on public.employer_profiles;
create trigger trg_sync_employer_listing_verification_tier_profile
after insert or update of is_beta_employer, verified_employer_manual_override, verified_employer
on public.employer_profiles
for each row
execute function public.trg_sync_employer_listing_verification_tier_from_profile();

drop trigger if exists trg_sync_employer_listing_verification_tier_subscription on public.subscriptions;
create trigger trg_sync_employer_listing_verification_tier_subscription
after insert or update of status, price_id or delete
on public.subscriptions
for each row
execute function public.trg_sync_employer_listing_verification_tier_from_subscription();

update public.internships i
set employer_verification_tier = public.resolve_employer_listing_verification_tier(i.employer_id)
where employer_verification_tier is distinct from public.resolve_employer_listing_verification_tier(i.employer_id);
