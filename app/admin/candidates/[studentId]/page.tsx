import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { formatPilotStage, normalizePilotStage } from '@/lib/pilotMode'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type Params = Promise<{ studentId: string }>
type SearchParams = Promise<{ success?: string; error?: string }>

type StudentProfileRow = {
  user_id: string
  school: string | null
  major?: { name?: string | null } | null
  majors: string[] | string | null
  year: string | null
  coursework: string[] | string | null
  interests: string | null
  experience_level: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  preferred_city: string | null
  preferred_state: string | null
  preferred_zip: string | null
  max_commute_minutes: number | null
  transport_mode: string | null
  exact_address_line1: string | null
}

type InternshipApplicationRow = {
  id: string
  internship_id: string
  student_id: string
  submitted_at: string | null
  created_at: string | null
  resume_url: string | null
  match_score: number | null
  notes: string | null
  pilot_stage: string | null
  pilot_score: number | null
  pilot_tags: string[] | null
  internship:
    | {
        title?: string | null
        company_name?: string | null
      }
    | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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

function formatMajor(value: string[] | string | null | undefined, canonicalName?: string | null) {
  if (typeof canonicalName === 'string' && canonicalName.trim()) return canonicalName
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function parseInterestSkills(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value) as { skills?: unknown }
    if (!Array.isArray(parsed.skills)) return []
    return parsed.skills.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function displayName(input: { email?: string | null; firstName?: string | null; lastName?: string | null; fallbackId: string }) {
  const joined = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ').trim()
  if (joined) return joined
  const emailName = input.email?.split('@')[0]?.trim()
  if (emailName) return emailName
  return `Student ${input.fallbackId.slice(0, 8)}`
}

function fieldRow(label: string, value: string) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  )
}

function tagList(tags: string[]) {
  if (tags.length === 0) return <span className="text-sm text-slate-500">None</span>
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          {tag}
        </span>
      ))}
    </div>
  )
}

export default async function AdminCandidateDossierPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: SearchParams
}) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/candidates/[studentId]' })
  const { studentId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!isUuid(studentId)) {
    redirect('/admin/students?error=Invalid+student+id')
  }

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Candidate dossier</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const admin = supabaseAdmin()

  const [
    profileResult,
    authUserResult,
    skillRowsResult,
    courseworkRowsResult,
    courseworkCategoryRowsResult,
    applicationsResult,
  ] = await Promise.all([
    admin
      .from('student_profiles')
      .select(
        'user_id, school, major:canonical_majors(name), majors, year, coursework, interests, experience_level, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, exact_address_line1'
      )
      .eq('user_id', studentId)
      .maybeSingle<StudentProfileRow>(),
    admin.auth.admin.getUserById(studentId),
    admin.from('student_skill_items').select('skill:skills(label)').eq('student_id', studentId),
    admin.from('student_coursework_items').select('coursework:coursework_items(name)').eq('student_id', studentId),
    admin.from('student_coursework_category_links').select('category:coursework_categories(name)').eq('student_id', studentId),
    admin
      .from('applications')
      .select(
        'id, internship_id, student_id, submitted_at, created_at, resume_url, match_score, notes, pilot_stage, pilot_score, pilot_tags, internship:internships(title, company_name)'
      )
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const profile = profileResult.data
  const authUser = authUserResult.data.user ?? null
  if (profileResult.error) {
    redirect(`/admin/students?error=${encodeURIComponent(profileResult.error.message)}`)
  }
  if (!profile) {
    redirect('/admin/students?error=Student+not+found')
  }

  const metadata = ((authUser?.user_metadata ?? {}) as {
    first_name?: string
    last_name?: string
    resume_path?: string
    avatar_url?: string
  })

  const canonicalSkills = Array.from(
    new Set(
      ((skillRowsResult.data ?? []) as Array<{ skill: { label?: string | null } | Array<{ label?: string | null }> | null }>)
        .flatMap((row) =>
          Array.isArray(row.skill)
            ? row.skill.map((entry) => (typeof entry?.label === 'string' ? entry.label.trim() : '')).filter(Boolean)
            : typeof row.skill?.label === 'string'
              ? [row.skill.label.trim()]
              : []
        )
    )
  )
  const canonicalCoursework = Array.from(
    new Set(
      ((courseworkRowsResult.data ?? []) as Array<{ coursework: { name?: string | null } | Array<{ name?: string | null }> | null }>)
        .flatMap((row) =>
          Array.isArray(row.coursework)
            ? row.coursework.map((entry) => (typeof entry?.name === 'string' ? entry.name.trim() : '')).filter(Boolean)
            : typeof row.coursework?.name === 'string'
              ? [row.coursework.name.trim()]
              : []
        )
    )
  )
  const courseworkCategories = Array.from(
    new Set(
      ((courseworkCategoryRowsResult.data ?? []) as Array<{ category: { name?: string | null } | Array<{ name?: string | null }> | null }>)
        .flatMap((row) =>
          Array.isArray(row.category)
            ? row.category.map((entry) => (typeof entry?.name === 'string' ? entry.name.trim() : '')).filter(Boolean)
            : typeof row.category?.name === 'string'
              ? [row.category.name.trim()]
              : []
        )
    )
  )

  const recentApplications = (applicationsResult.data ?? []) as InternshipApplicationRow[]
  const allSkills = Array.from(new Set([...canonicalSkills, ...parseInterestSkills(profile.interests)]))
  const legacyCoursework = parseStringList(profile.coursework)
  const resumeStoragePath =
    typeof metadata.resume_path === 'string' && metadata.resume_path.trim().length > 0
      ? metadata.resume_path.trim()
      : recentApplications.find((row) => typeof row.resume_url === 'string' && row.resume_url.trim().length > 0)?.resume_url ?? null
  const signedResumeUrl =
    resumeStoragePath
      ? (await admin.storage.from('resumes').createSignedUrl(resumeStoragePath, 60 * 60)).data?.signedUrl ?? null
      : null

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin/pilot-review"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Candidate dossier</h1>
          <p className="mt-1 text-sm text-slate-600">Single-page founder view for profile, concierge intake, and recent pilot activity.</p>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {displayName({
                  email: authUser?.email ?? null,
                  firstName: metadata.first_name ?? null,
                  lastName: metadata.last_name ?? null,
                  fallbackId: studentId,
                })}
              </h2>
              <div className="mt-1 text-sm text-slate-600">{authUser?.email ?? 'Email unavailable'}</div>
              <div className="mt-2 text-sm text-slate-600">
                {profile.school ?? 'School not set'} · {formatMajor(profile.majors, canonicalMajorName(profile.major))} · {profile.year ?? 'Year not set'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {signedResumeUrl ? (
                <a
                  href={signedResumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open resume
                </a>
              ) : null}
              <Link
                href={`/admin/matching/preview?student=${encodeURIComponent(studentId)}`}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Preview matches
              </Link>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Student profile</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fieldRow('School', profile.school ?? 'Not provided')}
                {fieldRow('Major', formatMajor(profile.majors, canonicalMajorName(profile.major)))}
                {fieldRow('Class standing', profile.year ?? 'Not provided')}
                {fieldRow('Experience level', profile.experience_level ?? 'Not provided')}
                {fieldRow('Availability start', profile.availability_start_month ?? 'Not provided')}
                {fieldRow(
                  'Hours per week',
                  typeof profile.availability_hours_per_week === 'number' ? `${profile.availability_hours_per_week}h/wk` : 'Not provided'
                )}
                {fieldRow(
                  'Preferred location',
                  [profile.preferred_city, profile.preferred_state, profile.preferred_zip].filter(Boolean).join(', ') || 'Not provided'
                )}
                {fieldRow(
                  'Commute flexibility',
                  typeof profile.max_commute_minutes === 'number' ? `${profile.max_commute_minutes} minutes` : 'Not provided'
                )}
                {fieldRow('Transport', profile.transport_mode ?? 'Not provided')}
              </dl>

              {profile.exact_address_line1 ? (
                <div className="mt-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Exact address</div>
                  <div className="mt-1 text-sm text-slate-900">{profile.exact_address_line1}</div>
                </div>
              ) : null}

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Skills</div>
                  <div className="mt-2">{tagList(allSkills)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Coursework categories</div>
                  <div className="mt-2">{tagList(courseworkCategories)}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Canonical coursework</div>
                  <div className="mt-2">{tagList(canonicalCoursework)}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Legacy coursework text</div>
                  <div className="mt-2">{tagList(legacyCoursework)}</div>
                </div>
              </div>

              {resumeStoragePath ? (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">Resume storage path</div>
                  <div className="mt-1 break-all text-xs text-slate-600">{resumeStoragePath}</div>
                </div>
              ) : null}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
              {recentApplications.length === 0 ? (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  No recent applications for this student.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Submitted</th>
                        <th className="px-3 py-2">Match</th>
                        <th className="px-3 py-2">Pilot status</th>
                        <th className="px-3 py-2">Links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentApplications.map((application) => (
                        <tr key={application.id}>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">{application.internship?.title ?? 'Internship'}</div>
                            <div className="text-xs text-slate-500">{application.internship?.company_name ?? 'Unknown company'}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{formatDateTime(application.submitted_at ?? application.created_at)}</td>
                          <td className="px-3 py-3 text-slate-700">
                            {application.match_score !== null ? `${application.match_score}` : 'n/a'}
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-slate-900">{formatPilotStage(application.pilot_stage)}</div>
                            <div className="text-xs text-slate-500">
                              {application.pilot_score !== null ? `Score ${application.pilot_score}/10` : 'No score'}
                              {application.pilot_tags?.length ? ` · ${application.pilot_tags.join(', ')}` : ''}
                            </div>
                            {application.notes?.trim() ? (
                              <div className="mt-1 text-xs text-slate-500">{application.notes.trim()}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/admin/internships/${encodeURIComponent(application.internship_id)}/applicants`}
                                className="text-xs font-medium text-blue-700 hover:underline"
                              >
                                Applicants
                              </Link>
                              <Link
                                href={`/admin/internships/${encodeURIComponent(application.internship_id)}/shortlist`}
                                className="text-xs font-medium text-blue-700 hover:underline"
                              >
                                Candidate pack
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Pilot intake</h2>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Pilot intake and founder-note fields are not available in this local `student_profiles` schema.
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Current signals</h2>
              <div className="mt-4 space-y-4">
                {fieldRow('Current stage summary', recentApplications[0] ? formatPilotStage(normalizePilotStage(recentApplications[0].pilot_stage)) : 'No applications yet')}
                {fieldRow('Last application', recentApplications[0] ? formatDateTime(recentApplications[0].submitted_at ?? recentApplications[0].created_at) : 'n/a')}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
