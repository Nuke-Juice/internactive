import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { isCuratedAtsFlow, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dispatchInAppNotifications } from '@/lib/notifications/dispatcher'

type InviteAction = 'invite' | 'confirm'

type RequestBody = {
  action?: unknown
  application_ids?: unknown
  message?: unknown
}

type ApplicationRow = {
  id: string
  student_id: string
  internship_id: string
  ats_invite_status: string | null
  internship?: {
    employer_id?: string | null
    title?: string | null
    company_name?: string | null
    apply_mode?: string | null
    ats_stage_mode?: string | null
    external_apply_url?: string | null
  } | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => isUuid(item))
    )
  )
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

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = typeof userRow?.role === 'string' ? userRow.role : null
  const isAdmin = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)
  const isEmployer = role === 'employer'

  if (!isAdmin && !isEmployer) {
    return NextResponse.json({ error: 'Employer or admin access required.' }, { status: 403 })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? (body.action.trim().toLowerCase() as InviteAction) : null
  const applicationIds = normalizeIds(body.application_ids)
  const inviteMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 400) : ''

  if (action !== 'invite' && action !== 'confirm') {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }
  if (applicationIds.length === 0) {
    return NextResponse.json({ error: 'No valid application IDs supplied.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: rows, error: rowsError } = await admin
    .from('applications')
    .select('id, student_id, internship_id, ats_invite_status, internship:internships!inner(employer_id, title, company_name, apply_mode, ats_stage_mode, external_apply_url)')
    .in('id', applicationIds)

  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 400 })
  }

  const applications = (rows ?? []) as ApplicationRow[]
  if (applications.length === 0) {
    return NextResponse.json({ error: 'No applications found.' }, { status: 404 })
  }

  if (!isAdmin) {
    const unauthorized = applications.some((row) => row.internship?.employer_id !== user.id)
    if (unauthorized) {
      return NextResponse.json({ error: 'You can only update applications for your own listings.' }, { status: 403 })
    }
  }

  const nowIso = new Date().toISOString()
  if (action === 'invite') {
    const invalidFlow = applications.find((row) => {
      const internship = row.internship
      return !isCuratedAtsFlow({
        applyMode: internship?.apply_mode,
        atsStageMode: internship?.ats_stage_mode,
      })
    })
    if (invalidFlow) {
      return NextResponse.json({ error: 'ATS invites are only available for listings using curated ATS mode.' }, { status: 400 })
    }

    const missingExternalUrl = applications.find((row) => !normalizeExternalApplyUrl(row.internship?.external_apply_url ?? null))
    if (missingExternalUrl) {
      return NextResponse.json({ error: 'ATS not configured for this listing.' }, { status: 400 })
    }

    const inviteable = applications.filter((row) => (row.ats_invite_status ?? 'not_invited') === 'not_invited')
    const inviteIds = inviteable.map((row) => row.id)

    if (inviteIds.length === 0) {
      return NextResponse.json({ updated: 0 })
    }

    const { error: updateError } = await admin
      .from('applications')
      .update({
        ats_invite_status: 'invited',
        ats_invited_at: nowIso,
        ats_invited_by: user.id,
        ats_invite_message: inviteMessage || null,
        external_apply_required: true,
      })
      .in('id', inviteIds)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    try {
      await dispatchInAppNotifications(
        inviteable.map((row) => ({
          userId: row.student_id,
          type: 'ats_invite_sent',
          title: 'You’ve been selected to move forward',
          body: 'You\'ve been selected to move forward. Complete the employer\'s official application to stay in consideration.',
          href: '/applications',
          metadata: {
            application_id: row.id,
            internship_id: row.internship_id,
            invite_message: inviteMessage || null,
          },
        }))
      )
    } catch (dispatchError) {
      console.warn('[notifications] ats_invite_sent dispatch failed', dispatchError)
    }

    return NextResponse.json({ updated: inviteIds.length })
  }

  const confirmable = applications.filter((row) => (row.ats_invite_status ?? '') === 'self_reported_complete')
  const confirmIds = confirmable.map((row) => row.id)
  if (confirmIds.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  const { error: confirmError } = await admin
    .from('applications')
    .update({ ats_invite_status: 'employer_confirmed' })
    .in('id', confirmIds)

  if (confirmError) {
    return NextResponse.json({ error: confirmError.message }, { status: 400 })
  }

  return NextResponse.json({ updated: confirmIds.length })
}
