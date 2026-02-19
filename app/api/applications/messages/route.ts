import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dispatchInAppNotification } from '@/lib/notifications/dispatcher'

type Body = {
  application_id?: unknown
  body?: unknown
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof roleRow?.role === 'string' ? roleRow.role : null
  const isAdmin = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const applicationId = typeof body.application_id === 'string' ? body.application_id.trim() : ''
  const messageBody = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : ''

  if (!isUuid(applicationId)) {
    return NextResponse.json({ error: 'Invalid application_id.' }, { status: 400 })
  }
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: application, error: appError } = await admin
    .from('applications')
    .select('id, student_id, internship_id, internship:internships!inner(employer_id, title, company_name)')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError) {
    return NextResponse.json({ error: appError.message }, { status: 400 })
  }
  if (!application?.id) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  }

  const studentId = application.student_id
  const employerId = (application.internship as { employer_id?: string | null } | null)?.employer_id ?? null
  if (!studentId || !employerId) {
    return NextResponse.json({ error: 'Application participants not found.' }, { status: 400 })
  }

  let recipientId: string | null = null
  if (user.id === studentId) {
    recipientId = employerId
  } else if (user.id === employerId || isAdmin) {
    recipientId = studentId
  }

  if (!recipientId) {
    return NextResponse.json({ error: 'Not authorized to message on this application.' }, { status: 403 })
  }

  const { error: insertError } = await admin.from('application_messages').insert({
    application_id: applicationId,
    sender_user_id: user.id,
    recipient_user_id: recipientId,
    body: messageBody,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  try {
    await dispatchInAppNotification({
      userId: recipientId,
      type: 'message_received',
      title: 'New message about your application',
      body: messageBody.length > 120 ? `${messageBody.slice(0, 117)}...` : messageBody,
      href: '/applications',
      metadata: { application_id: applicationId, internship_id: application.internship_id },
    })
  } catch (dispatchError) {
    console.warn('[notifications] message_received dispatch failed', dispatchError)
  }

  return NextResponse.json({ ok: true })
}
