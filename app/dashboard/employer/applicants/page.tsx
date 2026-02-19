import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import EmployerApplicantsInboxClient from '@/components/employer/inbox/EmployerApplicantsInboxClient'

type SearchParams = Promise<{ internship_id?: string }>

type ApplicationRow = {
  id: string
  internship_id: string
  student_id: string
  quick_apply_note: string | null
  ats_invite_status: string | null
  external_apply_completed_at: string | null
}

type InternshipRow = {
  id: string
  title: string | null
}

function normalizeInviteStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (
    normalized === 'invited' ||
    normalized === 'clicked' ||
    normalized === 'self_reported_complete' ||
    normalized === 'employer_confirmed'
  ) {
    return normalized
  }
  return 'not_invited'
}

function displayNameFromMetadata(input: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  fallbackId: string
}) {
  const first = (input.firstName ?? '').trim()
  const last = (input.lastName ?? '').trim()
  const full = [first, last].filter(Boolean).join(' ').trim()
  if (full) return full
  const emailName = (input.email ?? '').split('@')[0]?.trim()
  if (emailName && emailName.length > 0) return emailName
  return `Applicant ${input.fallbackId.slice(0, 8)}`
}

export default async function EmployerApplicantsPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedInternshipId = String(resolvedSearchParams?.internship_id ?? '').trim()

  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/applicants' })
  const supabase = await supabaseServer()

  const { data: internshipsData } = await supabase
    .from('internships')
    .select('id, title')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false })

  const internships = (internshipsData ?? []) as InternshipRow[]
  const internshipIds = internships.map((row) => row.id)
  const scopedInternshipIds =
    selectedInternshipId && internshipIds.includes(selectedInternshipId) ? [selectedInternshipId] : internshipIds

  const { data: applicationsData } =
    scopedInternshipIds.length > 0
      ? await supabase
          .from('applications')
          .select('id, internship_id, student_id, quick_apply_note, ats_invite_status, external_apply_completed_at')
          .in('internship_id', scopedInternshipIds)
          .order('created_at', { ascending: false })
      : {
          data: [] as ApplicationRow[],
        }

  const applications = (applicationsData ?? []) as ApplicationRow[]
  const studentIds = Array.from(new Set(applications.map((row) => row.student_id)))

  const canUseAdminClient = hasSupabaseAdminCredentials()
  const profileClient = canUseAdminClient ? supabaseAdmin() : supabase

  const { data: profiles } =
    studentIds.length > 0
      ? await profileClient
          .from('student_profiles')
          .select('user_id, school, major:canonical_majors(name), majors')
          .in('user_id', studentIds)
      : {
          data: [] as Array<{
            user_id: string
            school: string | null
            major: { name?: string | null } | null
            majors: string[] | string | null
          }>,
        }

  const studentNameById = new Map<string, string>()
  if (canUseAdminClient && studentIds.length > 0) {
    const admin = supabaseAdmin()
    const authRows = await Promise.all(
      studentIds.map(async (studentId) => {
        const { data } = await admin.auth.admin.getUserById(studentId)
        const authUser = data.user
        const metadata = (authUser?.user_metadata ?? {}) as { first_name?: string; last_name?: string }
        return [
          studentId,
          displayNameFromMetadata({
            firstName: metadata.first_name,
            lastName: metadata.last_name,
            email: authUser?.email,
            fallbackId: studentId,
          }),
        ] as const
      })
    )
    for (const [studentId, label] of authRows) {
      studentNameById.set(studentId, label)
    }
  }

  const profileByStudent = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      {
        school: profile.school?.trim() || 'School not set',
        major:
          (Array.isArray(profile.majors) ? profile.majors[0] : profile.majors) ||
          (typeof profile.major?.name === 'string' ? profile.major.name : '') ||
          'Major not set',
      },
    ])
  )

  const internshipTitleById = new Map(internships.map((row) => [row.id, row.title?.trim() || 'Internship']))

  const rows = applications.map((application) => {
    const profile = profileByStudent.get(application.student_id)
    return {
      applicationId: application.id,
      internshipId: application.internship_id,
      internshipTitle: internshipTitleById.get(application.internship_id) ?? 'Internship',
      studentId: application.student_id,
      studentName: studentNameById.get(application.student_id) ?? `Applicant ${application.student_id.slice(0, 8)}`,
      school: profile?.school ?? 'School not set',
      major: profile?.major ?? 'Major not set',
      quickApplyNote: application.quick_apply_note ?? null,
      atsInviteStatus: normalizeInviteStatus(application.ats_invite_status) as
        | 'not_invited'
        | 'invited'
        | 'clicked'
        | 'self_reported_complete'
        | 'employer_confirmed',
      externalApplyCompletedAt: application.external_apply_completed_at,
    }
  })

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-4">
          <Link
            href="/dashboard/employer"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Applicant inbox</h1>
          <p className="mt-1 text-sm text-slate-600">Review quick applies and invite top candidates into your ATS workflow.</p>
        </div>

        <EmployerApplicantsInboxClient rows={rows} defaultInternshipId={selectedInternshipId || undefined} />
      </section>
    </main>
  )
}
