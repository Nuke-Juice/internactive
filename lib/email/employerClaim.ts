import 'server-only'

import { Resend } from 'resend'

type SendEmployerClaimEmailInput = {
  to: string
  companyName?: string | null
  claimUrl: string
  expiresAtIso: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatExpiry(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '24 hours'
  return parsed.toUTCString()
}

export function buildEmployerClaimText(input: SendEmployerClaimEmailInput) {
  const company = input.companyName?.trim() || 'your company'
  return [
    `You have been invited to claim employer access for ${company}.`,
    '',
    `Claim link (single-use, expires ${formatExpiry(input.expiresAtIso)}):`,
    input.claimUrl,
    '',
    'If this was not expected, ignore this email.',
  ].join('\n')
}

export function buildEmployerClaimHtml(input: SendEmployerClaimEmailInput) {
  const company = input.companyName?.trim() || 'your company'
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
        <h1 style="margin:0 0 8px;font-size:22px;">Claim employer access</h1>
        <p style="margin:0;color:#334155;">You have been invited to claim employer access for <strong>${escapeHtml(company)}</strong>.</p>
        <p style="margin:12px 0 0;color:#334155;">This link is single-use and expires at ${escapeHtml(formatExpiry(input.expiresAtIso))}.</p>
        <div style="margin-top:16px;">
          <a href="${escapeHtml(input.claimUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Claim access</a>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function sendEmployerClaimEmail(input: SendEmployerClaimEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFromEmail = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !resendFromEmail) {
    return { sent: false as const, reason: 'provider_not_configured' as const }
  }

  const resend = new Resend(resendApiKey)
  const { error } = await resend.emails.send({
    from: resendFromEmail,
    to: input.to,
    subject: 'Claim your employer access',
    text: buildEmployerClaimText(input),
    html: buildEmployerClaimHtml(input),
  })

  if (error) {
    return { sent: false as const, reason: 'provider_error' as const, message: error.message ?? 'Email send failed' }
  }

  return { sent: true as const }
}
