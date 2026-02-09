import 'server-only'

import { Resend } from 'resend'
import { isVerifiedEmployerStatus } from '@/lib/billing/subscriptions'
import { getAppUrl } from '@/lib/billing/stripe'
import { supabaseAdmin } from '@/lib/supabase/admin'

type SendEmployerAlertParams = {
  applicationId: string
}

export async function sendEmployerApplicationAlert({ applicationId }: SendEmployerAlertParams) {
  const supabase = supabaseAdmin()

  const { data: application } = await supabase
    .from('applications')
    .select('id, internship_id, created_at')
    .eq('id', applicationId)
    .maybeSingle()

  if (!application?.internship_id) {
    return { sent: false, reason: 'application_not_found' as const }
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('id, title, employer_id')
    .eq('id', application.internship_id)
    .maybeSingle()

  if (!internship?.employer_id) {
    return { sent: false, reason: 'internship_not_found' as const }
  }

  const [{ data: subscription }, { data: employerProfile }] = await Promise.all([
    supabase.from('subscriptions').select('status').eq('user_id', internship.employer_id).maybeSingle(),
    supabase
      .from('employer_profiles')
      .select('contact_email, email_alerts_enabled')
      .eq('user_id', internship.employer_id)
      .maybeSingle(),
  ])

  if (!isVerifiedEmployerStatus(subscription?.status)) {
    return { sent: false, reason: 'employer_not_verified' as const }
  }

  if (employerProfile?.email_alerts_enabled === false) {
    return { sent: false, reason: 'alerts_disabled' as const }
  }

  const recipient = employerProfile?.contact_email?.trim() || ''
  if (!recipient) {
    return { sent: false, reason: 'missing_recipient' as const }
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const resendFromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendApiKey || !resendFromEmail) {
    return { sent: false, reason: 'provider_not_configured' as const }
  }

  const applicantsInboxUrl = `${getAppUrl()}/dashboard/employer/applicants`
  const internshipTitle = internship.title?.trim() || 'your internship'

  const resend = new Resend(resendApiKey)
  await resend.emails.send({
    from: resendFromEmail,
    to: recipient,
    subject: `New application for ${internshipTitle}`,
    text: `A new application was submitted for ${internshipTitle}. Review it in your applicants inbox: ${applicantsInboxUrl}`,
  })

  return { sent: true as const }
}
