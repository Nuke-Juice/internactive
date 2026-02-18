import 'server-only'
import { getStripeMode } from '@/lib/billing/prices'

export const STUDENT_PREMIUM_PLAN_KEY = 'student_premium'
export const STUDENT_PREMIUM_MONTHLY_PRICE_CENTS = 499

function readEnvForMode(base: string, mode: 'test' | 'live') {
  const suffix = mode === 'live' ? '_LIVE' : '_TEST'
  const key = `${base}${suffix}`
  const value = process.env[key]?.trim()
  return value && value.length > 0 ? value : null
}

export function getStudentPremiumPriceId(mode = getStripeMode()) {
  const modeSpecific = readEnvForMode('STUDENT_PREMIUM_PRICE_ID', mode)
  if (modeSpecific) return modeSpecific

  const fallback = (process.env.STUDENT_PREMIUM_PRICE_ID || '').trim()
  if (fallback) return fallback

  throw new Error(`Missing student premium price id for mode=${mode}`)
}
