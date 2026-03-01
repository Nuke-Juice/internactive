import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { evaluateSinglePreviewMatch, loadAdminInternshipPreviewItems, loadAdminStudentPreviewById } from '@/lib/admin/matchingPreview'
import { getMatchingReportSummary } from '@/lib/admin/matchingPreview'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

type Params = { params: Promise<{ studentId: string }> }

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request, { params }: Params) {
  const { studentId } = await params
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 })
  }
  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ error: 'Admin service credentials missing.' }, { status: 500 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof roleRow?.role === 'string' ? roleRow.role : null
  if (!(role && (ADMIN_ROLES as readonly string[]).includes(role))) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { internshipId?: string } | null
  const internshipId = String(body?.internshipId ?? '').trim()
  if (!isUuid(internshipId)) {
    return NextResponse.json({ error: 'Invalid internship id.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const student = await loadAdminStudentPreviewById(admin, studentId)
  if (!student) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 })
  }

  const internships = await loadAdminInternshipPreviewItems(admin, {}, { includeInactive: true, internshipId })
  const internship = internships[0] ?? null
  if (!internship) {
    return NextResponse.json({ error: 'Internship not found.' }, { status: 404 })
  }

  const match = evaluateSinglePreviewMatch(internship, student.profile)
  const matchScore = Math.round(
    typeof match.breakdown?.total_score === 'number' ? match.breakdown.total_score : match.score
  )
  const matchReasons = match.reasons.slice(0, 5)
  const matchingVersion = getMatchingReportSummary().matchingVersion

  const { data: existingApplication } = await admin
    .from('applications')
    .select('id, notes')
    .eq('student_id', studentId)
    .eq('internship_id', internshipId)
    .maybeSingle<{ id: string; notes: string | null }>()

  const conciergeNote = 'concierge shortlist'
  const nextNotes =
    existingApplication?.notes && existingApplication.notes.trim().length > 0
      ? existingApplication.notes.includes(conciergeNote)
        ? existingApplication.notes
        : `${existingApplication.notes}\n${conciergeNote}`
      : conciergeNote

  if (existingApplication?.id) {
    const { error } = await admin
      .from('applications')
      .update({
        pilot_stage: 'shortlist',
        match_score: matchScore,
        match_reasons: matchReasons,
        matching_version: matchingVersion,
        notes: nextNotes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', existingApplication.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    const now = new Date().toISOString()
    const { error } = await admin.from('applications').insert({
      student_id: studentId,
      internship_id: internshipId,
      status: 'submitted',
      pilot_stage: 'shortlist',
      submitted_at: now,
      reviewed_at: now,
      match_score: matchScore,
      match_reasons: matchReasons,
      matching_version: matchingVersion,
      notes: conciergeNote,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    href: `/admin/internships/${encodeURIComponent(internshipId)}/shortlist`,
  })
}
