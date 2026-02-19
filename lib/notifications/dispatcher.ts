import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

type NotificationType =
  | 'application_submitted'
  | 'ats_invite_sent'
  | 'ats_completed_self_reported'
  | 'message_received'

type DispatchNotificationInput = {
  userId: string
  type: NotificationType
  title: string
  body: string
  href?: string | null
  metadata?: Record<string, unknown>
}

function isEmailEnabled() {
  const raw = (process.env.EMAIL_PROVIDER_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

async function sendEmailStub(input: DispatchNotificationInput) {
  if (!isEmailEnabled()) {
    console.info('[notifications.email.stub] disabled', {
      type: input.type,
      userId: input.userId,
      title: input.title,
    })
    return
  }

  const from = (process.env.NOTIFICATIONS_FROM ?? '').trim()
  console.info('[notifications.email.stub] enabled_no_provider', {
    from: from || null,
    type: input.type,
    userId: input.userId,
    title: input.title,
  })
}

export async function dispatchInAppNotification(input: DispatchNotificationInput) {
  const admin = supabaseAdmin()
  const { error } = await admin.from('notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }

  await sendEmailStub(input)
}

export async function dispatchInAppNotifications(inputs: DispatchNotificationInput[]) {
  if (inputs.length === 0) return
  const admin = supabaseAdmin()
  const rows = inputs.map((input) => ({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
    metadata: input.metadata ?? {},
  }))

  const { error } = await admin.from('notifications').insert(rows)
  if (error) {
    throw new Error(error.message)
  }

  for (const input of inputs) {
    await sendEmailStub(input)
  }
}
