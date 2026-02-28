import 'server-only'

import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/src/lib/legalVersions'

type LegalAcceptanceSource = 'signup' | 'settings' | 'other'

export async function recordLegalAcceptance(params: {
  userId: string
  source?: LegalAcceptanceSource
  termsVersion?: string
  privacyVersion?: string
}) {
  if (!hasSupabaseAdminCredentials()) {
    console.warn('[legal.acceptance] admin_credentials_missing', {
      userId: params.userId,
      source: params.source ?? 'signup',
    })
    return { ok: false as const, error: 'Admin credentials unavailable.' }
  }

  const admin = supabaseAdmin()
  const { error } = await admin.from('legal_acceptances').upsert(
    {
      user_id: params.userId,
      terms_version: params.termsVersion ?? TERMS_VERSION,
      privacy_version: params.privacyVersion ?? PRIVACY_VERSION,
      source: params.source ?? 'signup',
      accepted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,terms_version,privacy_version,source' }
  )

  if (error) {
    console.warn('[legal.acceptance] upsert_failed', {
      userId: params.userId,
      source: params.source ?? 'signup',
      message: error.message,
    })
    return { ok: false as const, error: error.message }
  }

  return { ok: true as const }
}
