import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

type ApplicationDetailsRow = {
  id: string
  internship_id: string
  student_id: string
  submitted_at: string | null
  created_at: string | null
  employer_viewed_at: string | null
  match_score: number | null
  match_reasons: unknown
  resume_url: string | null
  status: string | null
  notes: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function parseReasons(value: unknown, matchScore: number | null) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((reason) => {
      const parsed = reason.match(/^([^:]+):\s*(.+)\s+\(\+([0-9]+(?:\.[0-9]+)?)\)$/)
      if (!parsed) return reason
      const [, label, details, pointsText] = parsed
      const points = Number(pointsText)
      if (!Number.isFinite(points) || typeof matchScore !== 'number' || matchScore <= 0) return reason
      const contribution = Math.max(0, Math.round((points / matchScore) * 100))
      return `${label.trim()}: ${details.trim()} (${contribution}% of total match score)`
    })
}

function formatMajor(value: string[] | string | null | undefined, canonicalName?: string | null) {
  if (typeof canonicalName === 'string' && canonicalName.trim()) return canonicalName
  if (Array.isArray(value) && value.length > 0) return value[0]
  if (typeof value === 'string' && value.trim()) return value.trim()
  return 'Major not set'
}

function canonicalMajorName(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined
    return typeof first?.name === 'string' ? first.name : null
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { name?: unknown }
    return typeof maybe.name === 'string' ? maybe.name : null
  }
  return null
}

function formatClassStanding(value: string | null | undefined) {
  if (typeof value !== 'string') return 'Class standing not set'
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : 'Class standing not set'
}

export default async function EmployerApplicantReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>
}) {
  const { applicationId } = await params
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/applicants' })
  const supabase = await supabaseServer()

  const { data: application } = await supabase
    .from('applications')
    .select('id, internship_id, student_id, submitted_at, created_at, employer_viewed_at, match_score, match_reasons, resume_url, status, notes')
    .eq('id', applicationId)
    .maybeSingle<ApplicationDetailsRow>()

  if (!application?.id || !application.internship_id) {
    redirect('/dashboard/employer/applicants?error=Application+not+found')
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('id, employer_id, title')
    .eq('id', application.internship_id)
    .eq('employer_id', user.id)
    .maybeSingle<{ id: string; employer_id: string; title: string | null }>()

  if (!internship?.id) {
    redirect('/dashboard/employer/applicants?error=Not+authorized+to+view+that+application')
  }

  if (!application.employer_viewed_at) {
    await supabase
      .from('applications')
      .update({ employer_viewed_at: new Date().toISOString(), reviewed_at: new Date().toISOString() })
      .eq('id', application.id)
      .eq('internship_id', internship.id)
  }

  const profileClient = hasSupabaseAdminCredentials() ? supabaseAdmin() : supabase
  const { data: profile } = await profileClient
    .from('student_profiles')
    .select('school, majors, major:canonical_majors(name), year, availability_hours_per_week, experience_level')
    .eq('user_id', application.student_id)
    .maybeSingle<{
      school: string | null
      majors: string[] | string | null
      major: { name?: string | null } | Array<{ name?: string | null }> | null
      year: string | null
      availability_hours_per_week: number | null
      experience_level: string | null
    }>()

  const reasons = parseReasons(application.match_reasons, application.match_score)
  const applicantName = `Applicant ${application.student_id.slice(0, 8)}`

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/employer/applicants"
          className="inline-flex items-center gap-1 rounded-md text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to applicant inbox
        </Link>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{applicantName}</h1>
              <p className="mt-1 text-sm text-slate-600">Applied to {internship.title ?? 'Internship'}</p>
            </div>
            {application.resume_url ? (
              <Link
                href={`/dashboard/employer/applicants/view/${encodeURIComponent(application.id)}`}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Open resume
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">University</div>
              <div className="mt-1 text-sm text-slate-900">{profile?.school?.trim() || 'University not set'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Major</div>
              <div className="mt-1 text-sm text-slate-900">{formatMajor(profile?.majors, canonicalMajorName(profile?.major))}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Class standing</div>
              <div className="mt-1 text-sm text-slate-900">{formatClassStanding(profile?.year)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</div>
              <div className="mt-1 text-sm text-slate-900">
                {typeof profile?.availability_hours_per_week === 'number' && profile.availability_hours_per_week > 0
                  ? `${profile.availability_hours_per_week} hrs/week`
                  : 'Not set'}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Application details</div>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>Status: {application.status ?? 'submitted'}</p>
              <p>Submitted: {formatDateTime(application.submitted_at ?? application.created_at)}</p>
              <p>
                Match score:{' '}
                {typeof application.match_score === 'number' ? `${Math.max(0, Math.round(application.match_score))}%` : 'Not available'}
              </p>
            </div>
            {reasons.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {reasons.slice(0, 5).map((reason) => (
                  <li key={`${application.id}-${reason}`}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {application.notes?.trim() ? (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employer notes</div>
                <p className="mt-1 whitespace-pre-wrap">{application.notes}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  )
}
