import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { formatPilotStage, formatPilotTags, normalizePilotStage, parsePilotTags, PILOT_STAGES } from '@/lib/pilotMode'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type SearchParams = Promise<{
  success?: string
  error?: string
}>

type StudentProfileRow = {
  user_id: string
  school: string | null
  majors: string[] | string | null
  year: string | null
  availability_start_month: string | null
  availability_hours_per_week: number | null
  concierge_opt_in: boolean | null
  concierge_intake_answers: unknown
  concierge_intake_completed_at: string | null
  concierge_score: number | null
  concierge_tags: string[] | null
  concierge_notes: string | null
}

type ApplicationRow = {
  id: string
  student_id: string
  internship_id: string
  submitted_at: string | null
  created_at: string | null
  notes: string | null
  pilot_stage: string | null
  pilot_score: number | null
  pilot_tags: string[] | null
  quick_apply_note: string | null
  match_score: number | null
  internship:
    | {
        id?: string | null
        title?: string | null
        company_name?: string | null
      }
    | null
}

type PilotListingRow = {
  id: string
  title: string | null
  company_name: string | null
  visibility: string | null
  is_pilot_listing: boolean | null
  created_at: string | null
}

type StudentOption = {
  id: string
  email: string | null
  name: string
  createdAt: string | null
  lastSeenAt: string | null
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

function displayName(input: { email?: string | null; firstName?: string | null; lastName?: string | null; fallbackId: string }) {
  const joined = [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ').trim()
  if (joined) return joined
  const emailName = input.email?.split('@')[0]?.trim()
  if (emailName) return emailName
  return `Student ${input.fallbackId.slice(0, 8)}`
}

function intakeShortPitch(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  return typeof (value as { short_pitch?: unknown }).short_pitch === 'string'
    ? String((value as { short_pitch?: unknown }).short_pitch).trim()
    : ''
}

function formatAvailability(row: StudentProfileRow) {
  const tokens = [
    row.availability_start_month?.trim(),
    typeof row.availability_hours_per_week === 'number' && row.availability_hours_per_week > 0
      ? `${row.availability_hours_per_week}h/wk`
      : null,
  ].filter((value): value is string => Boolean(value))
  return tokens.length > 0 ? tokens.join(' · ') : 'Availability not set'
}

export default async function AdminPilotReviewPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/pilot-review' })
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <section className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold text-slate-900">Pilot review</h1>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
        </section>
      </main>
    )
  }

  const admin = supabaseAdmin()

  const [studentsResult, applicationsResult, usersResult, appUsersResult, pilotListingsResult] = await Promise.all([
    admin
      .from('student_profiles')
      .select(
        'user_id, school, majors, year, availability_start_month, availability_hours_per_week, concierge_opt_in, concierge_intake_answers, concierge_intake_completed_at, concierge_score, concierge_tags, concierge_notes'
      )
      .eq('concierge_opt_in', true)
      .not('concierge_intake_completed_at', 'is', null)
      .order('concierge_intake_completed_at', { ascending: false })
      .limit(30),
    admin
      .from('applications')
      .select(
        'id, student_id, internship_id, submitted_at, created_at, notes, pilot_stage, pilot_score, pilot_tags, quick_apply_note, match_score, internship:internships(title, company_name)'
      )
      .order('submitted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(40),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('users').select('id, last_seen_at').limit(500),
    admin
      .from('internships')
      .select('id, title, company_name, visibility, is_pilot_listing, created_at')
      .eq('is_pilot_listing', true)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const profiles = (studentsResult.data ?? []) as StudentProfileRow[]
  const applications = (applicationsResult.data ?? []) as ApplicationRow[]
  const authUsers = usersResult.data?.users ?? []
  const userRows = appUsersResult.data ?? []
  const pilotListings = (pilotListingsResult.data ?? []) as PilotListingRow[]

  const studentIds = Array.from(new Set([...profiles.map((row) => row.user_id), ...applications.map((row) => row.student_id)]))
  const lastSeenByUserId = new Map(
    userRows
      .filter((row) => studentIds.includes(row.id))
      .map((row) => [row.id, typeof row.last_seen_at === 'string' ? row.last_seen_at : null] as const)
  )

  const authUserById = new Map(
    authUsers
      .filter((row) => studentIds.includes(row.id))
      .map((row) => {
        const metadata = (row.user_metadata ?? {}) as { first_name?: string; last_name?: string }
        return [
          row.id,
          {
            id: row.id,
            email: row.email ?? null,
            name: displayName({
              email: row.email ?? null,
              firstName: metadata.first_name ?? null,
              lastName: metadata.last_name ?? null,
              fallbackId: row.id,
            }),
            createdAt: row.created_at ?? null,
            lastSeenAt: lastSeenByUserId.get(row.id) ?? null,
          } satisfies StudentOption,
        ] as const
      })
  )

  const recentStudents = profiles
    .map((row) => ({
      ...row,
      auth: authUserById.get(row.user_id) ?? {
        id: row.user_id,
        email: null,
        name: `Student ${row.user_id.slice(0, 8)}`,
        createdAt: null,
        lastSeenAt: lastSeenByUserId.get(row.user_id) ?? null,
      },
    }))
    .slice(0, 20)

  async function updateStudentConciergeAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/pilot-review' })
    const adminWrite = supabaseAdmin()

    const studentId = String(formData.get('student_id') ?? '').trim()
    const conciergeScoreRaw = String(formData.get('concierge_score') ?? '').trim()
    const conciergeTagsInput = String(formData.get('concierge_tags') ?? '').trim()
    const conciergeNotes = String(formData.get('concierge_notes') ?? '').trim()

    if (!studentId) {
      redirect('/admin/pilot-review?error=Missing+student+id')
    }

    const conciergeScore =
      conciergeScoreRaw.length > 0 && Number.isFinite(Number(conciergeScoreRaw))
        ? Math.max(0, Math.min(10, Math.round(Number(conciergeScoreRaw))))
        : null

    const { error } = await adminWrite
      .from('student_profiles')
      .update({
        concierge_score: conciergeScore,
        concierge_tags: parsePilotTags(conciergeTagsInput),
        concierge_notes: conciergeNotes || null,
      })
      .eq('user_id', studentId)

    if (error) {
      redirect(`/admin/pilot-review?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/admin/pilot-review?success=student')
  }

  async function updateApplicationPilotAction(formData: FormData) {
    'use server'

    await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/pilot-review' })
    const adminWrite = supabaseAdmin()

    const applicationId = String(formData.get('application_id') ?? '').trim()
    const pilotStage = normalizePilotStage(String(formData.get('pilot_stage') ?? '').trim())
    const pilotScoreRaw = String(formData.get('pilot_score') ?? '').trim()
    const pilotTagsInput = String(formData.get('pilot_tags') ?? '').trim()
    const notes = String(formData.get('notes') ?? '').trim()

    if (!applicationId) {
      redirect('/admin/pilot-review?error=Missing+application+id')
    }

    const pilotScore =
      pilotScoreRaw.length > 0 && Number.isFinite(Number(pilotScoreRaw))
        ? Math.max(0, Math.min(10, Math.round(Number(pilotScoreRaw))))
        : null

    const { error } = await adminWrite
      .from('applications')
      .update({
        pilot_stage: pilotStage,
        pilot_score: pilotScore,
        pilot_tags: parsePilotTags(pilotTagsInput),
        notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId)

    if (error) {
      redirect(`/admin/pilot-review?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/admin/pilot-review?success=application')
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div>
          <Link
            href="/admin"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Pilot review</h1>
          <p className="mt-1 text-sm text-slate-600">Single control center for concierge-pool students and direct applications.</p>
        </div>

        {resolvedSearchParams?.error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}
        {resolvedSearchParams?.success ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {resolvedSearchParams.success === 'student' ? 'Concierge student updated.' : 'Application updated.'}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Concierge pool students</h2>
            <p className="mt-1 text-sm text-slate-600">Recent students who completed intake and opted into founder-led matching.</p>
          </div>

          <div className="space-y-4">
            {recentStudents.map((row) => (
              <form key={row.user_id} action={updateStudentConciergeAction} className="rounded-xl border border-slate-200 p-4">
                <input type="hidden" name="student_id" value={row.user_id} />

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{row.auth.name}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {row.school ?? 'School not set'} · {formatMajor(row.majors)} · {row.year ?? 'Year not set'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Intake {formatDateTime(row.concierge_intake_completed_at)} · Last seen {formatDateTime(row.auth.lastSeenAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/matching/preview?student=${encodeURIComponent(row.user_id)}`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Preview matches
                    </Link>
                    <Link
                      href="/admin/students"
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Student admin
                    </Link>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">Availability</div>
                  <div>{formatAvailability(row)}</div>
                </div>

                {intakeShortPitch(row.concierge_intake_answers) ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Pitch:</span> {intakeShortPitch(row.concierge_intake_answers)}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Concierge score</label>
                    <input
                      type="number"
                      name="concierge_score"
                      min="0"
                      max="10"
                      defaultValue={row.concierge_score ?? ''}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Concierge tags</label>
                    <input
                      type="text"
                      name="concierge_tags"
                      defaultValue={formatPilotTags(row.concierge_tags)}
                      placeholder="ops, strong communicator, summer-ready"
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Internal notes</label>
                  <textarea
                    name="concierge_notes"
                    rows={3}
                    defaultValue={row.concierge_notes ?? ''}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {row.auth.email ?? 'Email unavailable'}{row.concierge_score !== null ? ` · Score ${row.concierge_score}/10` : ''}
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Save student
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Pilot listings</h2>
            <p className="mt-1 text-sm text-slate-600">Recent pilot listings and whether students can browse them publicly.</p>
          </div>

          <div className="space-y-3">
            {pilotListings.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{listing.title ?? 'Untitled internship'}</div>
                    <div className="mt-1 text-sm text-slate-600">{listing.company_name ?? 'Unknown company'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Visibility: {listing.visibility === 'public_browse' ? 'Public browse' : 'Admin only'} · Created {formatDateTime(listing.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/internships/${encodeURIComponent(listing.id)}`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit listing
                    </Link>
                    <Link
                      href={`/admin/internships/${encodeURIComponent(listing.id)}/applicants`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open applicants
                    </Link>
                    <Link
                      href={`/admin/internships/${encodeURIComponent(listing.id)}/shortlist`}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open shortlist
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">New applications</h2>
            <p className="mt-1 text-sm text-slate-600">Fast founder triage for direct applies.</p>
          </div>

          <div className="space-y-4">
            {applications.map((application) => {
              const auth = authUserById.get(application.student_id)
              return (
                <form key={application.id} action={updateApplicationPilotAction} className="rounded-xl border border-slate-200 p-4">
                  <input type="hidden" name="application_id" value={application.id} />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{auth?.name ?? `Student ${application.student_id.slice(0, 8)}`}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {(application.internship?.title ?? 'Internship')} · {(application.internship?.company_name ?? 'Unknown company')}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Submitted {formatDateTime(application.submitted_at ?? application.created_at)}
                        {application.match_score !== null ? ` · Match ${application.match_score}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/internships/${encodeURIComponent(application.internship_id)}/applicants`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Open applicants
                      </Link>
                      <Link
                        href={`/admin/internships/${encodeURIComponent(application.internship_id)}/shortlist`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Candidate pack
                      </Link>
                    </div>
                  </div>

                  {application.quick_apply_note?.trim() ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Quick apply note:</span> {application.quick_apply_note}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Pilot stage</label>
                      <select
                        name="pilot_stage"
                        defaultValue={normalizePilotStage(application.pilot_stage)}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      >
                        {PILOT_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {formatPilotStage(stage)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Pilot score</label>
                      <input
                        type="number"
                        name="pilot_score"
                        min="0"
                        max="10"
                        defaultValue={application.pilot_score ?? ''}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Pilot tags</label>
                      <input
                        type="text"
                        name="pilot_tags"
                        defaultValue={formatPilotTags(application.pilot_tags)}
                        placeholder="finance, warm intro, strong resume"
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-xs font-medium uppercase tracking-wide text-slate-600">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={application.notes ?? ''}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Current stage: {formatPilotStage(application.pilot_stage)}
                      {application.pilot_score !== null ? ` · Score ${application.pilot_score}/10` : ''}
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )
            })}
          </div>
        </section>
      </section>
    </main>
  )
}
