import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/billing/stripe'
import { sendEmployerClaimEmail } from '@/lib/email/employerClaim'
import {
  claimTokenExpiresAt,
  generateEmployerClaimToken,
  hashEmployerClaimToken,
} from '@/lib/auth/employerClaimToken'

export type EmployerClaimTokenRow = {
  employer_id: string
  created_at: string
  expires_at: string
  used_at: string | null
  contact_email?: string | null
}

export type EmployerClaimStatus = {
  pendingCount: number
  lastSentAt: string | null
  lastClaimedAt: string | null
  lastSentTo: string | null
  latestPendingExpiresAt: string | null
}

export function buildEmployerClaimStatus(tokens: EmployerClaimTokenRow[], now = new Date()) {
  const nowMs = now.getTime()
  let pendingCount = 0
  let lastSentAt: string | null = null
  let lastClaimedAt: string | null = null
  let lastSentTo: string | null = null
  let latestPendingExpiresAt: string | null = null

  for (const token of tokens) {
    const createdAtMs = new Date(token.created_at).getTime()
    const expiresAtMs = new Date(token.expires_at).getTime()
    const usedAtMs = token.used_at ? new Date(token.used_at).getTime() : NaN

    if (!lastSentAt || createdAtMs > new Date(lastSentAt).getTime()) {
      lastSentAt = token.created_at
      lastSentTo = token.contact_email?.trim().toLowerCase() || null
    }

    if (token.used_at && (!lastClaimedAt || usedAtMs > new Date(lastClaimedAt).getTime())) {
      lastClaimedAt = token.used_at
    }

    if (!token.used_at && Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
      pendingCount += 1
      if (!latestPendingExpiresAt || expiresAtMs > new Date(latestPendingExpiresAt).getTime()) {
        latestPendingExpiresAt = token.expires_at
      }
    }
  }

  return {
    pendingCount,
    lastSentAt,
    lastClaimedAt,
    lastSentTo,
    latestPendingExpiresAt,
  }
}

function isDeliverableClaimEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  if (normalized.endsWith('@example.invalid')) return false
  if (normalized.endsWith('.invalid')) return false
  return true
}

export async function sendEmployerClaimLink(params: {
  admin: SupabaseClient
  adminUserId: string
  employerId: string
  contactEmail: string
  companyName?: string | null
  internshipId: string | null
  invalidateExisting: boolean
  actionType: 'send_claim_link' | 'send_claim_link_resend'
}) {
  const {
    admin,
    adminUserId,
    employerId,
    contactEmail,
    companyName,
    internshipId,
    invalidateExisting,
    actionType,
  } = params

  const recipient = contactEmail.trim().toLowerCase()
  if (!recipient) {
    return { ok: false as const, error: 'Employer contact_email is required before sending claim link' }
  }
  if (!isDeliverableClaimEmail(recipient)) {
    return {
      ok: false as const,
      error: 'Employer contact_email is a placeholder. Set a real recipient email before sending claim links.',
    }
  }

  let appUrl = ''
  try {
    appUrl = getAppUrl()
  } catch {
    return { ok: false as const, error: 'NEXT_PUBLIC_APP_URL is required to send claim links' }
  }

  const nowIso = new Date().toISOString()
  if (invalidateExisting) {
    const { error: invalidateError } = await admin
      .from('employer_claim_tokens')
      .update({ used_at: nowIso, used_by: adminUserId })
      .eq('employer_id', employerId)
      .is('used_at', null)
      .gt('expires_at', nowIso)

    if (invalidateError) {
      return { ok: false as const, error: invalidateError.message }
    }
  }

  const rawToken = generateEmployerClaimToken()
  const tokenHash = hashEmployerClaimToken(rawToken)
  const expiresAt = claimTokenExpiresAt()
  const claimUrl = `${appUrl}/claim/employer?token=${encodeURIComponent(rawToken)}`

  const { data: insertedToken, error: tokenInsertError } = await admin
    .from('employer_claim_tokens')
    .insert({
      internship_id: internshipId,
      employer_id: employerId,
      contact_email: recipient,
      token_hash: tokenHash,
      expires_at: expiresAt,
      sent_by: adminUserId,
    })
    .select('id')
    .single()

  if (tokenInsertError || !insertedToken?.id) {
    return { ok: false as const, error: tokenInsertError?.message ?? 'Could not create claim token' }
  }

  const sendResult = await sendEmployerClaimEmail({
    to: recipient,
    companyName: companyName ?? null,
    claimUrl,
    expiresAtIso: expiresAt,
  })

  if (!sendResult.sent) {
    await admin.from('employer_claim_tokens').delete().eq('id', insertedToken.id)
    return {
      ok: false as const,
      error: sendResult.reason === 'provider_not_configured' ? 'Email provider not configured' : sendResult.message ?? 'Email send failed',
    }
  }

  const { error: logError } = await admin.from('admin_actions').insert({
    internship_id: internshipId,
    employer_id: employerId,
    sent_to: recipient,
    sent_by: adminUserId,
    action_type: actionType,
    metadata: {
      expires_at: expiresAt,
      invalidate_existing: invalidateExisting,
    },
  })

  if (logError) {
    return { ok: false as const, error: logError.message }
  }

  return { ok: true as const, expiresAt }
}
