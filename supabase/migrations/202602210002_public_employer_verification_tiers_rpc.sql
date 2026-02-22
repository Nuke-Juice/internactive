create or replace function public.get_employer_listing_verification_tiers(target_user_ids uuid[])
returns table (user_id uuid, tier text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.user_id,
    public.resolve_employer_listing_verification_tier(u.user_id) as tier
  from unnest(coalesce(target_user_ids, '{}'::uuid[])) as u(user_id);
$$;
