import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { checkRateLimitForRequest } from '@/lib/security/requestProtection'

type ExportMode = 'csv' | 'emails' | 'packet_links' | 'summary'
type ExportScope = 'current' | 'all'
type InviteStatus = 'not_invited' | 'invited' | 'clicked' | 'self_reported_complete' | 'employer_confirmed'

type ApplicationRow = {
  id: string
  internship_id: string
  student_id: string
  submitted_at: string | null
  created_at: string | null
  ats_invite_status: string | null
  ats_invited_at: string | null
  external_apply_clicks: number | null
  external_apply_completed_at: string | null
  quick_apply_note: string | null
  resume_url: string | null
}

type InternshipRow = {
  id: string
  title: string | null
  employer_id: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

function normalizeInviteStatus(value: string | null | undefined): InviteStatus {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'invited' || normalized === 'clicked' || normalized === 'self_reported_complete' || normalized === 'employer_confirmed') {
    return normalized
  }
  return 'not_invited'
}

function toSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'listing'
}

function parseMajors(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function toTabStatuses(tab: string) {
  if (tab === 'new') return ['not_invited'] as InviteStatus[]
  if (tab === 'invited') return ['invited', 'clicked'] as InviteStatus[]
  if (tab === 'completed') return ['self_reported_complete'] as InviteStatus[]
  if (tab === 'finalists') return ['employer_confirmed'] as InviteStatus[]
  return null
}

function canExposeEmailForStatus(status: InviteStatus) {
  return status !== 'not_invited'
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const internshipId = url.searchParams.get('internship_id')?.trim() ?? ''
  const modeRaw = (url.searchParams.get('mode') ?? 'csv').trim().toLowerCase()
  const scopeRaw = (url.searchParams.get('scope') ?? 'current').trim().toLowerCase()
  const tabRaw = (url.searchParams.get('tab') ?? 'all').trim().toLowerCase()

  const mode: ExportMode = modeRaw === 'emails' || modeRaw === 'packet_links' || modeRaw === 'summary' ? modeRaw : 'csv'
  const scope: ExportScope = scopeRaw === 'all' ? 'all' : 'current'

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof userRow?.role === 'string' ? userRow.role : null
  const isAdmin = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)
  const isEmployer = role === 'employer'
  if (!isAdmin && !isEmployer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (mode === 'csv') {
    const rateLimit = await checkRateLimitForRequest({
      key: `applicants_export_csv:${user.id}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: `Too many exports. Try again in ${rateLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      )
    }
  }

  let internshipsQuery = supabase.from('internships').select('id, title, employer_id')
  if (internshipId && isUuid(internshipId)) internshipsQuery = internshipsQuery.eq('id', internshipId)
  if (!isAdmin) internshipsQuery = internshipsQuery.eq('employer_id', user.id)

  const { data: internshipRows, error: internshipsError } = await internshipsQuery
  if (internshipsError) return NextResponse.json({ error: internshipsError.message }, { status: 400 })

  const internships = (internshipRows ?? []) as InternshipRow[]
  if (internships.length === 0) return NextResponse.json({ error: 'No internships available to export.' }, { status: 404 })

  const internshipIds = internships.map((row) => row.id)
  const internshipById = new Map(internships.map((row) => [row.id, row]))

  const { data: appRows, error: appError } = await supabase
    .from('applications')
    .select(
      'id, internship_id, student_id, submitted_at, created_at, ats_invite_status, ats_invited_at, external_apply_clicks, external_apply_completed_at, quick_apply_note, resume_url'
    )
    .in('internship_id', internshipIds)
    .order('created_at', { ascending: false })

  if (appError) return NextResponse.json({ error: appError.message }, { status: 400 })

  const requestedStatuses = scope === 'all' ? null : toTabStatuses(tabRaw)
  const filteredApplications = ((appRows ?? []) as ApplicationRow[]).filter((row) => {
    if (!requestedStatuses) return true
    return requestedStatuses.includes(normalizeInviteStatus(row.ats_invite_status))
  })

  const studentIds = Array.from(new Set(filteredApplications.map((row) => row.student_id)))
  const canUseAdminClient = hasSupabaseAdminCredentials()
  const profileClient = canUseAdminClient ? supabaseAdmin() : supabase

  const { data: profileRows } =
    studentIds.length > 0
      ? await profileClient
          .from('student_profiles')
          .select('user_id, school, year, majors, major:canonical_majors(name)')
          .in('user_id', studentIds)
      : { data: [] }

  const profileByUserId = new Map(
    (profileRows ?? []).map((row) => {
      const majors = parseMajors((row as { majors?: string[] | string | null }).majors)
      const canonicalMajor = typeof (row as { major?: { name?: string | null } | null }).major?.name === 'string'
        ? String((row as { major?: { name?: string | null } }).major?.name)
        : ''
      if (canonicalMajor && !majors.includes(canonicalMajor)) majors.push(canonicalMajor)
      return [
        (row as { user_id: string }).user_id,
        {
          school: String((row as { school?: string | null }).school ?? '').trim(),
          year: String((row as { year?: string | null }).year ?? '').trim(),
          majors,
        },
      ] as const
    })
  )

  const studentNameById = new Map<string, string>()
  const studentEmailById = new Map<string, string>()

  if (canUseAdminClient && studentIds.length > 0) {
    const admin = supabaseAdmin()
    const authRows = await Promise.all(
      studentIds.map(async (studentId) => {
        const { data } = await admin.auth.admin.getUserById(studentId)
        const authUser = data.user
        const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string; full_name?: string }
        const first = (metadata.first_name ?? '').trim()
        const last = (metadata.last_name ?? '').trim()
        const fullFromParts = [first, last].filter(Boolean).join(' ').trim()
        const full = fullFromParts || (metadata.full_name ?? '').trim() || (authUser?.email?.split('@')[0] ?? '').trim() || `Applicant ${studentId.slice(0, 8)}`
        const email = (authUser?.email ?? '').trim()
        return { studentId, full, email }
      })
    )
    for (const row of authRows) {
      studentNameById.set(row.studentId, row.full)
      studentEmailById.set(row.studentId, row.email)
    }
  }

  const resumePathSet = Array.from(new Set(filteredApplications.map((row) => row.resume_url).filter((value): value is string => Boolean(value))))
  const signedResumeByPath = new Map<string, string>()
  if (canUseAdminClient && resumePathSet.length > 0) {
    const admin = supabaseAdmin()
    await Promise.all(
      resumePathSet.map(async (resumePath) => {
        const { data } = await admin.storage.from('resumes').createSignedUrl(resumePath, 60 * 60)
        if (data?.signedUrl) signedResumeByPath.set(resumePath, data.signedUrl)
      })
    )
  }

  const exportRows = filteredApplications.map((application) => {
    const status = normalizeInviteStatus(application.ats_invite_status)
    const internship = internshipById.get(application.internship_id)
    const profile = profileByUserId.get(application.student_id)
    const studentName = studentNameById.get(application.student_id) ?? `Applicant ${application.student_id.slice(0, 8)}`
    const studentEmail = studentEmailById.get(application.student_id) ?? ''
    const visibleEmail = canExposeEmailForStatus(status) ? studentEmail : ''
    const resumeUrl = application.resume_url
      ? signedResumeByPath.get(application.resume_url) ?? application.resume_url
      : ''

    return {
      applicationId: application.id,
      internshipId: application.internship_id,
      internshipTitle: internship?.title ?? 'Internship',
      submittedAt: application.submitted_at ?? application.created_at,
      status,
      studentName,
      studentEmail: visibleEmail,
      school: profile?.school ?? '',
      majors: profile?.majors.join('; ') ?? '',
      yearInSchool: profile?.year ?? '',
      resumeUrl,
      quickApplyNote: application.quick_apply_note ?? '',
      atsInvitedAt: application.ats_invited_at ?? '',
      externalApplyClicks: application.external_apply_clicks ?? 0,
      externalApplyCompletedAt: application.external_apply_completed_at ?? '',
      applicationDetailUrl: `/dashboard/employer/applicants/review/${application.id}`,
      packetLink: `/dashboard/employer/applicants/review/${application.id}`,
    }
  })

  if (mode === 'emails') {
    const uniqueEmails = Array.from(new Set(exportRows.map((row) => row.studentEmail).filter(Boolean)))
    return NextResponse.json({ text: uniqueEmails.join('\n'), count: uniqueEmails.length })
  }

  if (mode === 'packet_links') {
    const links = exportRows.map((row) => row.packetLink)
    return NextResponse.json({ text: links.join('\n'), count: links.length })
  }

  if (mode === 'summary') {
    const invitedCount = exportRows.filter((row) => row.status === 'invited' || row.status === 'clicked').length
    const completedCount = exportRows.filter((row) => row.status === 'self_reported_complete').length
    const confirmedCount = exportRows.filter((row) => row.status === 'employer_confirmed').length
    const summary = [
      `Total applicants: ${exportRows.length}`,
      `Invited to ATS: ${invitedCount}`,
      `Completed ATS (self-reported): ${completedCount}`,
      `Confirmed finalists: ${confirmedCount}`,
    ].join('\n')
    return NextResponse.json({ text: summary, count: exportRows.length })
  }

  const csvHeader = [
    'application_id',
    'submitted_at',
    'status',
    'student_name',
    'student_email',
    'school',
    'majors',
    'graduation_year_or_year_in_school',
    'resume_url',
    'quick_apply_note',
    'ats_invited_at',
    'external_apply_clicks',
    'external_apply_completed_at',
    'application_detail_url',
  ]

  const csvLines = [
    csvHeader.map((column) => escapeCsv(column)).join(','),
    ...exportRows.map((row) =>
      [
        row.applicationId,
        row.submittedAt,
        row.status,
        row.studentName,
        row.studentEmail,
        row.school,
        row.majors,
        row.yearInSchool,
        row.resumeUrl,
        row.quickApplyNote,
        row.atsInvitedAt,
        row.externalApplyClicks,
        row.externalApplyCompletedAt,
        row.applicationDetailUrl,
      ]
        .map((value) => escapeCsv(value))
        .join(',')
    ),
  ]

  const csv = `\uFEFF${csvLines.join('\n')}`
  const singleInternship = internshipId && internshipById.get(internshipId)
  const slugOrId = singleInternship?.title ? toSlug(singleInternship.title) : internshipId || 'multiple'
  const dateLabel = new Date().toISOString().slice(0, 10)
  const fileName = `internactive_applicants_${slugOrId}_${dateLabel}.csv`

  const analyticsInternshipId = internshipId || (internshipIds.length === 1 ? internshipIds[0] : 'multiple')
  await trackAnalyticsEvent({
    eventName: 'applicants_exported_csv',
    userId: user.id,
    properties: {
      internship_id: analyticsInternshipId,
      employer_id: isAdmin ? (singleInternship?.employer_id ?? null) : user.id,
      count: exportRows.length,
      scope,
      tab: scope === 'all' ? 'all' : tabRaw,
    },
  })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
