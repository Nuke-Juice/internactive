import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type StudentPremiumStatus = 'free' | 'trial' | 'active' | 'expired' | 'canceled'

type StudentPremiumRow = {
  user_id: string
  status: StudentPremiumStatus
  trial_started_at: string | null
  trial_expires_at: string | null
  active_since: string | null
  current_period_end: string | null
}

export type StudentEntitlements = {
  isPremiumActive: boolean
  isTrial: boolean
  trialDaysRemaining: number
  status: StudentPremiumStatus
  trialExpiresAt: string | null
}

function toDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function computeTrialDaysRemaining(trialExpiresAt: string | null | undefined) {
  const expiresAt = toDate(trialExpiresAt)
  if (!expiresAt) return 0
  const now = Date.now()
  const diffMs = expiresAt.getTime() - now
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

export async function ensureStudentPremiumStatusRow(userId: string, options?: { supabase?: SupabaseClient }) {
  const supabase = options?.supabase ?? supabaseAdmin()

  const { data } = await supabase
    .from('student_premium_status')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (data?.user_id) return

  await supabase.from('student_premium_status').upsert(
    {
      user_id: userId,
      status: 'free',
    },
    { onConflict: 'user_id' }
  )
}

function toEntitlements(row: StudentPremiumRow | null): StudentEntitlements {
  const status = row?.status ?? 'free'
  const trialExpiresAt = row?.trial_expires_at ?? null
  const now = Date.now()
  const trialExpiry = toDate(trialExpiresAt)
  const isTrial = status === 'trial'
  const isTrialActive = isTrial && Boolean(trialExpiry && trialExpiry.getTime() > now)
  const isPremiumActive = status === 'active' || isTrialActive

  return {
    isPremiumActive,
    isTrial,
    trialDaysRemaining: isTrial ? computeTrialDaysRemaining(trialExpiresAt) : 0,
    status,
    trialExpiresAt,
  }
}

export async function maybeExpireTrial(userId: string, options?: { supabase?: SupabaseClient }) {
  const supabase = options?.supabase ?? supabaseAdmin()
  await ensureStudentPremiumStatusRow(userId, { supabase })

  const { data } = await supabase
    .from('student_premium_status')
    .select('status, trial_expires_at')
    .eq('user_id', userId)
    .maybeSingle<StudentPremiumRow>()

  if (!data || data.status !== 'trial') return null

  const expiresAt = toDate(data.trial_expires_at)
  if (!expiresAt) return null
  if (expiresAt.getTime() > Date.now()) return null

  const { data: updated } = await supabase
    .from('student_premium_status')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'trial')
    .select('user_id, status, trial_started_at, trial_expires_at, active_since, current_period_end')
    .maybeSingle<StudentPremiumRow>()

  return updated ?? null
}

export async function getStudentEntitlements(userId: string, options?: { supabase?: SupabaseClient }): Promise<StudentEntitlements> {
  const supabase = options?.supabase ?? supabaseAdmin()
  await maybeExpireTrial(userId, { supabase })
  await ensureStudentPremiumStatusRow(userId, { supabase })

  const { data } = await supabase
    .from('student_premium_status')
    .select('user_id, status, trial_started_at, trial_expires_at, active_since, current_period_end')
    .eq('user_id', userId)
    .maybeSingle<StudentPremiumRow>()

  return toEntitlements(data ?? null)
}
