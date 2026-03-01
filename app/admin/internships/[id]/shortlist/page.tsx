import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { formatPilotStage, normalizePilotStage } from '@/lib/pilotMode'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type Params = Promise<{ id: string }>

type InternshipRow = {
  id: string
  title: string | null
  company_name: string | null
}

type ApplicationRow = {
  id: string
  student_id: string
  submitted_at: string | null
  created_at: string | null
  resume_url: string | null
  match_reasons: unknown
  quick_apply_note: string | null
  pilot_stage: string | null
  pilot_score: number | null
  match_score: number | null
}

type StudentProfileRow = {
  user_id: string
  school: string | null
  majors: string[] | string | null
  year: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  concierge_intake_answers: unknown
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function formatMajor(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function formatAvailability(profile: StudentProfileRow | undefined) {
  if (!profile) return 'Availability not set'
  const tokens = []
  if (profile.availability_start_month?.trim()) tokens.push(profile.availability_start_month.trim())
  if (typeof profile.availability_hours_per_week === 'number' && profile.availability_hours_per_week > 0) {
    tokens.push(`${profile.availability_hours_per_week}h/wk`)
  }
  return tokens.length > 0 ? tokens.join(' · ') : 'Availability not set'
}

function parseReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function getShortPitch(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  const maybe = value as { short_pitch?: unknown }
  return typeof maybe.short_pitch === 'string' ? maybe.short_pitch.trim() : ''
}

function buildHighlights(application: ApplicationRow, profile: StudentProfileRow | undefined) {
  const highlights: string[] = []

  for (const reason of parseReasons(application.match_reasons)) {
    if (reason && highlights.length < 3) highlights.push(reason)
  }

  if (application.quick_apply_note?.trim() && highlights.length < 3) {
    highlights.push(application.quick_apply_note.trim())
  }

  const shortPitch = getShortPitch(profile?.concierge_intake_answers)
  if (shortPitch && highlights.length < 3) {
    highlights.push(shortPitch)
  }

  return Array.from(new Set(highlights.filter(Boolean))).slice(0, 3)
}

function buildCandidatePackText(input: {
  internshipTitle: string
  companyName: string
  candidates: Array<{
    studentId: string
    name: string
    school: string
    major: string
    year: string
    availability: string
    resumeUrl: string | null
    pilotStage: string
    pilotScore: number | null
    highlights: string[]
  }>
}) {
  const lines = [
    `Candidate pack for ${input.internshipTitle}`,
    input.companyName ? `Company: ${input.companyName}` : '',
    '',
  ].filter(Boolean)

  if (input.candidates.length === 0) {
    lines.push('No shortlisted candidates yet.')
    return lines.join('\n')
  }

  for (const [index, candidate] of input.candidates.entries()) {
    lines.push(
      `${index + 1}. ${candidate.name} | ${candidate.school} | ${candidate.major} | ${candidate.year}`,
      `   Stage: ${candidate.pilotStage}${candidate.pilotScore !== null ? ` | Score: ${candidate.pilotScore}/10` : ''}`,
      `   Availability: ${candidate.availability}`,
      `   Resume: ${candidate.resumeUrl ? '[Open resume in admin UI]' : 'Not available'}`,
      `   Dossier: /admin/candidates/${candidate.studentId}`
    )
    for (const highlight of candidate.highlights) {
      lines.push(`   - ${highlight}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

function shortlistStagePriority(value: string | null | undefined) {
  const normalized = normalizePilotStage(value)
  if (normalized === 'shortlist') return 0
  if (normalized === 'screened') return 1
  if (normalized === 'new') return 2
  if (normalized === 'introduced') return 3
  if (normalized === 'interviewing') return 4
  if (normalized === 'hired') return 5
  return 6
}

export default async function AdminInternshipShortlistPage({
  params,
}: {
  params: Params
}) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/internships/[id]/shortlist' })
  const { id: internshipId } = await params

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Candidate pack</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const admin = supabaseAdmin()

  const [{ data: internship }, { data: applicationRows }] = await Promise.all([
    admin.from('internships').select('id, title, company_name').eq('id', internshipId).maybeSingle<InternshipRow>(),
    admin
      .from('applications')
      .select('id, student_id, submitted_at, created_at, resume_url, match_reasons, quick_apply_note, pilot_stage, pilot_score, match_score')
      .eq('internship_id', internshipId)
      .order('submitted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (!internship?.id) {
    redirect('/admin/internships?error=Internship+not+found')
  }

  const applications = (applicationRows ?? []) as ApplicationRow[]
  const studentIds = Array.from(new Set(applications.map((row) => row.student_id)))

  const [{ data: profileRows }, usersResult] = await Promise.all([
    studentIds.length > 0
      ? admin
          .from('student_profiles')
          .select('user_id, school, majors, year, availability_start_month, availability_hours_per_week, concierge_intake_answers')
          .in('user_id', studentIds)
      : { data: [] as StudentProfileRow[] },
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ])

  const profileByStudentId = new Map(((profileRows ?? []) as StudentProfileRow[]).map((row) => [row.user_id, row] as const))
  const authUserById = new Map(
    (usersResult.data?.users ?? []).map((user) => {
      const metadata = (user.user_metadata ?? {}) as { first_name?: string; last_name?: string }
      const joined = [metadata.first_name?.trim(), metadata.last_name?.trim()].filter(Boolean).join(' ').trim()
      return [
        user.id,
        {
          name: joined || user.email?.split('@')[0]?.trim() || `Student ${user.id.slice(0, 8)}`,
        },
      ] as const
    })
  )

  const uniqueResumePaths = Array.from(new Set(applications.map((row) => row.resume_url).filter(Boolean))) as string[]
  const signedResumeEntries = await Promise.all(
    uniqueResumePaths.map(async (path) => {
      const { data } = await admin.storage.from('resumes').createSignedUrl(path, 60 * 60)
      return [path, data?.signedUrl ?? null] as const
    })
  )
  const signedResumeByPath = new Map(signedResumeEntries)

  const candidates = applications
    .map((application) => {
      const profile = profileByStudentId.get(application.student_id)
      return {
        applicationId: application.id,
        studentId: application.student_id,
        name: authUserById.get(application.student_id)?.name ?? `Student ${application.student_id.slice(0, 8)}`,
        school: profile?.school ?? 'School not set',
        major: formatMajor(profile?.majors),
        year: profile?.year ?? 'Year not set',
        availability: formatAvailability(profile),
        resumeUrl: application.resume_url ? signedResumeByPath.get(application.resume_url) ?? null : null,
        pilotStage: formatPilotStage(application.pilot_stage),
        pilotStagePriority: shortlistStagePriority(application.pilot_stage),
        pilotScore: application.pilot_score,
        matchScore: application.match_score,
        submittedAt: application.submitted_at ?? application.created_at,
        highlights: buildHighlights(application, profile),
      }
    })
    .sort((a, b) => {
      if (a.pilotStagePriority !== b.pilotStagePriority) return a.pilotStagePriority - b.pilotStagePriority
      const aScore = typeof a.pilotScore === 'number' ? a.pilotScore : -1
      const bScore = typeof b.pilotScore === 'number' ? b.pilotScore : -1
      if (aScore !== bScore) return bScore - aScore
      const aMatch = typeof a.matchScore === 'number' ? a.matchScore : -1
      const bMatch = typeof b.matchScore === 'number' ? b.matchScore : -1
      if (aMatch !== bMatch) return bMatch - aMatch
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 5)

  const candidatePackText = buildCandidatePackText({
    internshipTitle: internship.title ?? 'Internship',
    companyName: internship.company_name ?? '',
    candidates,
  })

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href={`/admin/internships/${encodeURIComponent(internshipId)}/applicants`}
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Candidate pack</h1>
          <p className="mt-1 text-sm text-slate-600">
            {internship.title ?? 'Internship'}{internship.company_name ? ` · ${internship.company_name}` : ''}
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Top candidates</h2>
              <p className="mt-1 text-sm text-slate-600">Sorted for concierge review: shortlist first, then screened, then new.</p>
            </div>
          </div>

          <div className="space-y-4">
            {candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                No candidates are ready for this pack yet.
              </div>
            ) : (
              candidates.map((candidate) => (
                <article key={candidate.applicationId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        <Link href={`/admin/candidates/${encodeURIComponent(candidate.studentId)}`} className="text-blue-700 hover:underline">
                          {candidate.name}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {candidate.school} · {candidate.major} · {candidate.year}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.pilotStage}
                        {candidate.pilotScore !== null ? ` · Score ${candidate.pilotScore}/10` : ''}
                        {candidate.submittedAt ? ` · Submitted ${formatDateTime(candidate.submittedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/candidates/${encodeURIComponent(candidate.studentId)}`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View candidate
                      </Link>
                      {candidate.resumeUrl ? (
                        <Link
                          href={candidate.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open resume
                        </Link>
                      ) : (
                        <div className="text-sm text-slate-500">Resume not available</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Availability:</span> {candidate.availability}
                  </div>

                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                    {candidate.highlights.length > 0 ? (
                      candidate.highlights.map((highlight, index) => <li key={`${candidate.applicationId}-${index}`}>{highlight}</li>)
                    ) : (
                      <li>No highlights captured yet.</li>
                    )}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Copy candidate pack</h2>
          <p className="mt-1 text-sm text-slate-600">Plain-text block formatted for email or manual outreach.</p>
          <textarea
            readOnly
            value={candidatePackText}
            className="mt-4 min-h-[280px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-900"
          />
        </section>
      </section>
    </main>
  )
}
