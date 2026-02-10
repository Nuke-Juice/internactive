import 'server-only'

import { Resend } from 'resend'

export type EmployerSummaryCandidate = {
  name: string
  school: string
  major: string
  gradYear: string
  matchScore: number | null
  topReasons: string[]
  resumeUrl: string | null
}

type SendEmployerSummaryEmailInput = {
  to: string
  internshipTitle: string
  applicantCount: number
  topCandidates: EmployerSummaryCandidate[]
  claimInboxUrl: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatScore(value: number | null) {
  return typeof value === 'number' ? String(value) : 'N/A'
}

export function buildEmployerSummaryText(input: SendEmployerSummaryEmailInput) {
  const lines = [
    `Applicant summary for ${input.internshipTitle}`,
    '',
    `Total applicants: ${input.applicantCount}`,
    '',
    'Top candidates:',
  ]

  if (input.topCandidates.length === 0) {
    lines.push('- No candidates yet.')
  }

  for (const [index, candidate] of input.topCandidates.entries()) {
    lines.push(
      `${index + 1}. ${candidate.name} | ${candidate.school} | ${candidate.major} | ${candidate.gradYear} | Match ${formatScore(candidate.matchScore)}`
    )

    if (candidate.topReasons.length > 0) {
      lines.push(`   Reasons: ${candidate.topReasons.join(' | ')}`)
    }

    lines.push(`   Resume: ${candidate.resumeUrl ?? 'Not provided'}`)
  }

  lines.push('', `Claim inbox: ${input.claimInboxUrl}`)
  return lines.join('\n')
}

export function buildEmployerSummaryHtml(input: SendEmployerSummaryEmailInput) {
  const candidateRows =
    input.topCandidates.length === 0
      ? '<p style="margin:8px 0 0;color:#475569;">No candidates yet.</p>'
      : input.topCandidates
          .map((candidate, index) => {
            const reasons =
              candidate.topReasons.length > 0
                ? `<ul style="margin:6px 0 0;padding-left:18px;color:#334155;">${candidate.topReasons
                    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
                    .join('')}</ul>`
                : '<div style="margin-top:6px;color:#64748b;">No reasons captured.</div>'
            const resume = candidate.resumeUrl
              ? `<a href="${escapeHtml(candidate.resumeUrl)}" style="color:#1d4ed8;text-decoration:none;">View resume</a>`
              : '<span style="color:#64748b;">No resume</span>'

            return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-top:12px;">
              <div style="font-weight:600;color:#0f172a;">${index + 1}. ${escapeHtml(candidate.name)}</div>
              <div style="margin-top:4px;color:#334155;font-size:14px;">${escapeHtml(candidate.school)} | ${escapeHtml(candidate.major)} | ${escapeHtml(candidate.gradYear)}</div>
              <div style="margin-top:4px;color:#334155;font-size:14px;">Match score: ${escapeHtml(formatScore(candidate.matchScore))}</div>
              ${reasons}
              <div style="margin-top:8px;font-size:14px;">${resume}</div>
            </div>`
          })
          .join('')

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
        <h1 style="margin:0 0 8px;font-size:22px;">Applicant summary: ${escapeHtml(input.internshipTitle)}</h1>
        <p style="margin:0;color:#334155;">Total applicants: <strong>${input.applicantCount}</strong></p>
        <h2 style="margin:18px 0 0;font-size:16px;">Top candidates</h2>
        ${candidateRows}
        <div style="margin-top:18px;">
          <a href="${escapeHtml(input.claimInboxUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Claim inbox</a>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function sendEmployerSummaryEmail(input: SendEmployerSummaryEmailInput) {
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFromEmail = process.env.RESEND_FROM_EMAIL

  if (!resendApiKey || !resendFromEmail) {
    return { sent: false as const, reason: 'provider_not_configured' as const }
  }

  const resend = new Resend(resendApiKey)
  const { error } = await resend.emails.send({
    from: resendFromEmail,
    to: input.to,
    subject: `Top candidates for ${input.internshipTitle}`,
    text: buildEmployerSummaryText(input),
    html: buildEmployerSummaryHtml(input),
  })

  if (error) {
    return { sent: false as const, reason: 'provider_error' as const, message: error.message ?? 'Email send failed' }
  }

  return { sent: true as const }
}
