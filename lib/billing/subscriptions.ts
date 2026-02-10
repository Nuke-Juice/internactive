import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmployerPlan, type EmployerPlan, type EmployerPlanId } from './plan.ts'

const VERIFIED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export function isVerifiedEmployerStatus(status: string | null | undefined) {
  if (!status) return false
  return VERIFIED_SUBSCRIPTION_STATUSES.has(status)
}

export function resolveEmployerPlanId(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlanId {
  const { status, priceId } = params
  if (!isVerifiedEmployerStatus(status)) return 'free'
  if (!priceId) return 'starter'

  const starterPriceId = process.env.STARTER_PRICE_ID || process.env.STRIPE_PRICE_VERIFIED_EMPLOYER || ''
  const proPriceId = process.env.PRO_PRICE_ID || ''
  const legacyGrowthPriceId = process.env.GROWTH_PRICE_ID || ''

  if ((proPriceId && priceId === proPriceId) || (legacyGrowthPriceId && priceId === legacyGrowthPriceId)) return 'pro'
  if (starterPriceId && priceId === starterPriceId) return 'starter'
  return 'starter'
}

export function resolveEmployerPlan(params: { status: string | null | undefined; priceId: string | null | undefined }): EmployerPlan {
  return getEmployerPlan(resolveEmployerPlanId(params))
}

export async function getEmployerVerificationStatus(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { supabase, userId } = params
  const { data, error } = await supabase.from('subscriptions').select('status, price_id').eq('user_id', userId).maybeSingle()

  if (error) {
    const fallbackPlan = getEmployerPlan('free')
    return { isVerifiedEmployer: false, status: null as string | null, planId: fallbackPlan.id, plan: fallbackPlan, priceId: null as string | null }
  }

  const status = data?.status ?? null
  const priceId = data?.price_id ?? null
  const plan = resolveEmployerPlan({ status, priceId })
  return {
    isVerifiedEmployer: isVerifiedEmployerStatus(status),
    status,
    planId: plan.id,
    plan,
    priceId,
  }
}
