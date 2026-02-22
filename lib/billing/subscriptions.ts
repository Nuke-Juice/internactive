import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmployerPlan, type EmployerPlan, type EmployerPlanId } from './plan.ts'
import { getOptionalPriceIdForPlan } from './prices'
import type { EmployerVerificationTier } from '@/lib/internships/locationType'

const VERIFIED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export function isVerifiedEmployerStatus(status: string | null | undefined) {
  if (!status) return false
  return VERIFIED_SUBSCRIPTION_STATUSES.has(status)
}

export function resolveEmployerPlanId(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlanId {
  const { status, priceId } = params
  if (!isVerifiedEmployerStatus(status)) return 'free'
  if (!priceId) return 'free'

  const starterPriceId = getOptionalPriceIdForPlan('starter')
  const proPriceId = getOptionalPriceIdForPlan('pro')
  const legacyGrowthPriceId = (process.env.GROWTH_PRICE_ID || '').trim()

  if ((proPriceId && priceId === proPriceId) || (legacyGrowthPriceId && priceId === legacyGrowthPriceId)) return 'pro'
  if (starterPriceId && priceId === starterPriceId) return 'starter'
  return 'free'
}

export function resolveEmployerPlan(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlan {
  return getEmployerPlan(resolveEmployerPlanId(params))
}

export function getEmployerPaidAccess(params: {
  status: string | null | undefined
  isBetaEmployer: boolean
}) {
  return isVerifiedEmployerStatus(params.status) || params.isBetaEmployer
}

export function getEmployerFeaturePlanId(params: {
  subscriptionPlanId: EmployerPlanId
  isBetaEmployer: boolean
}): EmployerPlanId {
  if (!params.isBetaEmployer) return params.subscriptionPlanId
  return params.subscriptionPlanId === 'free' ? 'pro' : params.subscriptionPlanId
}

export function getEmployerListingLimit(params: {
  plan: EmployerPlan
  isBetaEmployer: boolean
}) {
  if (params.isBetaEmployer) return null
  return params.plan.maxActiveInternships
}

export function resolveEmployerVerificationTier(params: {
  planId: EmployerPlanId
  isVerifiedEmployer: boolean
}): EmployerVerificationTier {
  if (params.planId === 'pro' || params.planId === 'starter') {
    return params.planId
  }
  return params.isVerifiedEmployer ? 'pro' : 'free'
}

export async function getEmployerVerificationStatus(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { supabase, userId } = params
  const [{ data: subscriptionData, error: subscriptionError }, { data: employerProfileData }] = await Promise.all([
    supabase.from('subscriptions').select('status, price_id').eq('user_id', userId).maybeSingle(),
    supabase
      .from('employer_profiles')
      .select('verified_employer, verified_employer_manual_override, is_beta_employer')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (subscriptionError) {
    const fallbackPlan = getEmployerPlan('free')
    return {
      isVerifiedEmployer: false,
      hasPaidAccess: false,
      isBetaEmployer: false,
      status: null as string | null,
      planId: fallbackPlan.id,
      plan: fallbackPlan,
      priceId: null as string | null,
      listingLimit: fallbackPlan.maxActiveInternships,
    }
  }

  const status = subscriptionData?.status ?? null
  const priceId = subscriptionData?.price_id ?? null
  const subscriptionPlan = resolveEmployerPlan({ status, priceId })
  const isBetaEmployer = Boolean((employerProfileData as { is_beta_employer?: boolean | null } | null)?.is_beta_employer)
  const hasPaidAccess = getEmployerPaidAccess({ status, isBetaEmployer })
  const planId = getEmployerFeaturePlanId({ subscriptionPlanId: subscriptionPlan.id, isBetaEmployer })
  const basePlan = getEmployerPlan(planId)
  const plan =
    isBetaEmployer && basePlan.maxActiveInternships !== null ? { ...basePlan, maxActiveInternships: null } : basePlan
  const listingLimit = getEmployerListingLimit({ plan, isBetaEmployer })
  const hasManualOverride = Boolean((employerProfileData as { verified_employer_manual_override?: boolean | null } | null)?.verified_employer_manual_override)
  const paidVerifiedTier = hasPaidAccess && plan.id === 'pro'
  const isVerifiedEmployer = hasManualOverride || paidVerifiedTier || isBetaEmployer

  return {
    isVerifiedEmployer,
    hasPaidAccess,
    isBetaEmployer,
    status,
    planId,
    plan,
    priceId,
    listingLimit,
  }
}

export async function getEmployerVerificationTier(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { data: resolvedTier } = await params.supabase.rpc('resolve_employer_listing_verification_tier', {
    target_user_id: params.userId,
  })
  if (resolvedTier === 'pro' || resolvedTier === 'starter') return resolvedTier
  if (resolvedTier === 'free') return 'free'

  const status = await getEmployerVerificationStatus(params)
  return resolveEmployerVerificationTier({ planId: status.planId, isVerifiedEmployer: status.isVerifiedEmployer })
}

export async function getEmployerVerificationTiers(params: {
  supabase: SupabaseClient
  userIds: string[]
}) {
  const uniqueUserIds = Array.from(new Set(params.userIds.map((id) => id.trim()).filter(Boolean)))
  const tiers = new Map<string, EmployerVerificationTier>()
  if (uniqueUserIds.length === 0) return tiers

  const { data: resolvedRows } = await params.supabase.rpc('get_employer_listing_verification_tiers', {
    target_user_ids: uniqueUserIds,
  })
  for (const row of (resolvedRows ?? []) as Array<{ user_id: string; tier: string | null }>) {
    if (typeof row.user_id !== 'string') continue
    const tier = row.tier
    tiers.set(row.user_id, tier === 'pro' || tier === 'starter' ? tier : 'free')
  }
  if (tiers.size > 0) return tiers

  const [{ data: subscriptions }, { data: profiles }] = await Promise.all([
    params.supabase.from('subscriptions').select('user_id, status, price_id').in('user_id', uniqueUserIds),
    params.supabase
      .from('employer_profiles')
      .select('user_id, verified_employer_manual_override, is_beta_employer')
      .in('user_id', uniqueUserIds),
  ])

  const subscriptionByUser = new Map(
    (subscriptions ?? [])
      .filter((row): row is { user_id: string; status: string | null; price_id: string | null } => typeof row.user_id === 'string')
      .map((row) => [row.user_id, row])
  )
  const profileByUser = new Map(
    (profiles ?? [])
      .filter(
        (row): row is {
          user_id: string
          verified_employer_manual_override: boolean | null
          is_beta_employer: boolean | null
        } => typeof row.user_id === 'string'
      )
      .map((row) => [row.user_id, row])
  )

  for (const userId of uniqueUserIds) {
    const subscription = subscriptionByUser.get(userId)
    const profile = profileByUser.get(userId)
    const status = subscription?.status ?? null
    const priceId = subscription?.price_id ?? null
    const isBetaEmployer = Boolean(profile?.is_beta_employer)
    const subscriptionPlanId = resolveEmployerPlan({ status, priceId }).id
    const planId = getEmployerFeaturePlanId({ subscriptionPlanId, isBetaEmployer })
    const hasPaidAccess = getEmployerPaidAccess({ status, isBetaEmployer })
    const hasManualOverride = Boolean(profile?.verified_employer_manual_override)
    const isVerifiedEmployer = hasManualOverride || (hasPaidAccess && planId === 'pro') || isBetaEmployer

    tiers.set(
      userId,
      resolveEmployerVerificationTier({
        planId,
        isVerifiedEmployer,
      })
    )
  }

  return tiers
}
