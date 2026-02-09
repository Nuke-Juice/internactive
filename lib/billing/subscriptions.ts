import type { SupabaseClient } from '@supabase/supabase-js'

const VERIFIED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export function isVerifiedEmployerStatus(status: string | null | undefined) {
  if (!status) return false
  return VERIFIED_SUBSCRIPTION_STATUSES.has(status)
}

export async function getEmployerVerificationStatus(params: {
  supabase: SupabaseClient
  userId: string
}) {
  const { supabase, userId } = params
  const { data, error } = await supabase.from('subscriptions').select('status').eq('user_id', userId).maybeSingle()

  if (error) {
    return { isVerifiedEmployer: false, status: null as string | null }
  }

  return {
    isVerifiedEmployer: isVerifiedEmployerStatus(data?.status),
    status: data?.status ?? null,
  }
}
