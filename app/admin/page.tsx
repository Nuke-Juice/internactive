import Link from 'next/link'
import { Briefcase, Mail, Users } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type PilotListingRow = {
  id: string
  title: string | null
  company_name: string | null
  created_at: string | null
  status: string | null
  is_active: boolean | null
  is_pilot_listing: boolean | null
}

type ConciergeStudentRow = {
  user_id: string
  school: string | null
  majors: string[] | string | null
  concierge_opt_in: boolean | null
  concierge_intake_completed_at: string | null
}

type PilotApplicationRow = {
  id: string
  student_id: string
  internship_id: string
  pilot_stage: string | null
  submitted_at: string | null
  created_at: string | null
}

type ActiveMatchRow = {
  internshipId: string
  role: string
  employer: string
  candidatesSent: number
  status: 'Shortlisting' | 'Intro Sent' | 'Interviewing' | 'Closed'
  nextActionLabel: string
  nextActionHref: string
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

function formatMajor(value: ConciergeStudentRow['majors']) {
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function isActivePilotListing(listing: PilotListingRow) {
  return listing.is_pilot_listing === true && (listing.is_active === true || listing.status === 'published')
}

function metricCard(input: {
  label: string
  value: string
  hint: string
  icon: ComponentType<{ className?: string }>
}) {
  const Icon = input.icon
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{input.label}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{input.value}</div>
          <div className="mt-1 text-xs text-slate-600">{input.hint}</div>
        </div>
        <span className="rounded-lg bg-slate-100 p-2">
          <Icon className="h-4 w-4 text-slate-700" />
        </span>
      </div>
    </article>
  )
}

function actionCard(input: {
  title: string
  count: number
  hint: string
  href: string
  cta: string
  preview: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{input.title}</h2>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{input.count}</div>
          <p className="mt-1 text-sm text-slate-600">{input.hint}</p>
        </div>
      </div>
      <div className="mt-4">{input.preview}</div>
      <Link
        href={input.href}
        className="mt-4 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {input.cta}
        <span aria-hidden>→</span>
      </Link>
    </article>
  )
}

export default async function AdminDashboardPage() {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin' })

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8">
        <section className="mx-auto max-w-7xl space-y-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pilot control center</h1>
            <p className="mt-1 text-sm text-slate-600">
              Founder-led placement queue for concierge students, shortlists, and active intros.
            </p>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/pilot-review" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Review concierge students
            </Link>
            <Link href="/admin/internships" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Open pilot listings
            </Link>
            <Link href="/admin/students" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Manage students
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const admin = supabaseAdmin()

  const [
    poolCountResult,
    activeRolesCountResult,
    introsPendingCountResult,
    studentsResult,
    listingsResult,
    applicationsResult,
  ] = await Promise.all([
    admin
      .from('student_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('concierge_opt_in', true)
      .not('concierge_intake_completed_at', 'is', null),
    admin
      .from('internships')
      .select('id', { count: 'exact', head: true })
      .eq('is_pilot_listing', true)
      .or('is_active.eq.true,status.eq.published'),
    admin.from('applications').select('id', { count: 'exact', head: true }).eq('pilot_stage', 'introduced'),
    admin
      .from('student_profiles')
      .select('user_id, school, majors, concierge_opt_in, concierge_intake_completed_at')
      .eq('concierge_opt_in', true)
      .not('concierge_intake_completed_at', 'is', null)
      .order('concierge_intake_completed_at', { ascending: false })
      .limit(200),
    admin
      .from('internships')
      .select('id, title, company_name, created_at, status, is_active, is_pilot_listing')
      .eq('is_pilot_listing', true)
      .order('created_at', { ascending: false })
      .limit(300),
    admin
      .from('applications')
      .select('id, student_id, internship_id, pilot_stage, submitted_at, created_at')
      .order('submitted_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1500),
  ])

  const conciergeStudents = (studentsResult.data ?? []) as ConciergeStudentRow[]
  const pilotListings = ((listingsResult.data ?? []) as PilotListingRow[]).filter((listing) => listing.is_pilot_listing === true)
  const pilotApplications = (applicationsResult.data ?? []) as PilotApplicationRow[]

  const activePilotListings = pilotListings.filter(isActivePilotListing)
  const listingById = new Map(pilotListings.map((listing) => [listing.id, listing] as const))
  const applicationsByStudent = new Map<string, PilotApplicationRow[]>()
  const applicationsByInternship = new Map<string, PilotApplicationRow[]>()

  for (const application of pilotApplications) {
    if (!listingById.has(application.internship_id)) continue

    const studentBucket = applicationsByStudent.get(application.student_id) ?? []
    studentBucket.push(application)
    applicationsByStudent.set(application.student_id, studentBucket)

    const internshipBucket = applicationsByInternship.get(application.internship_id) ?? []
    internshipBucket.push(application)
    applicationsByInternship.set(application.internship_id, internshipBucket)
  }

  const newConciergeStudents = conciergeStudents
    .filter((student) => (applicationsByStudent.get(student.user_id) ?? []).length === 0)
    .slice(0, 5)

  const listingsNeedingShortlist = activePilotListings
    .filter((listing) => {
      const rows = applicationsByInternship.get(listing.id) ?? []
      return !rows.some((row) => row.pilot_stage === 'shortlist')
    })
    .slice(0, 5)

  const introsAwaitingReplyAll = pilotApplications.filter(
    (application) => application.pilot_stage === 'introduced' && listingById.has(application.internship_id)
  )
  const introsAwaitingReply = introsAwaitingReplyAll.slice(0, 5)

  const matchedStudentIds = new Set(
    pilotApplications
      .filter((application) => ['shortlist', 'introduced', 'interviewing', 'hired'].includes(application.pilot_stage ?? ''))
      .map((application) => application.student_id)
  )

  const activeMatches = activePilotListings
    .map((listing) => {
      const rows = applicationsByInternship.get(listing.id) ?? []
      const shortlisted = rows.filter((row) => row.pilot_stage === 'shortlist')
      const introduced = rows.filter((row) => row.pilot_stage === 'introduced')
      const interviewing = rows.filter((row) => row.pilot_stage === 'interviewing')
      const hired = rows.filter((row) => row.pilot_stage === 'hired')

      if (shortlisted.length === 0 && introduced.length === 0 && interviewing.length === 0 && hired.length === 0) {
        return null
      }

      let status: ActiveMatchRow['status'] = 'Shortlisting'
      let nextActionLabel = 'Build shortlist'
      let nextActionHref = `/admin/internships/${encodeURIComponent(listing.id)}/shortlist`

      if (hired.length > 0) {
        status = 'Closed'
        nextActionLabel = 'View role'
        nextActionHref = `/admin/internships/${encodeURIComponent(listing.id)}`
      } else if (interviewing.length > 0) {
        status = 'Interviewing'
        nextActionLabel = 'Check progress'
        nextActionHref = `/admin/internships/${encodeURIComponent(listing.id)}/applicants?status=interviewing`
      } else if (introduced.length > 0) {
        status = 'Intro Sent'
        nextActionLabel = 'Follow up'
        nextActionHref = `/admin/internships/${encodeURIComponent(listing.id)}/applicants?status=introduced`
      }

      return {
        internshipId: listing.id,
        role: listing.title?.trim() || 'Untitled role',
        employer: listing.company_name?.trim() || 'Unknown employer',
        candidatesSent: introduced.length + interviewing.length + hired.length,
        status,
        nextActionLabel,
        nextActionHref,
      } satisfies ActiveMatchRow
    })
    .filter((row): row is ActiveMatchRow => row !== null)
    .sort((left, right) => {
      const priority = {
        'Shortlisting': 0,
        'Intro Sent': 1,
        Interviewing: 2,
        Closed: 3,
      } as const

      if (priority[left.status] !== priority[right.status]) return priority[left.status] - priority[right.status]
      return left.role.localeCompare(right.role)
    })
    .slice(0, 12)

  const studentsInPool = poolCountResult.count ?? conciergeStudents.length
  const studentsMatched = matchedStudentIds.size
  const activeRoles = activeRolesCountResult.count ?? activePilotListings.length
  const introsPending = introsPendingCountResult.count ?? introsAwaitingReplyAll.length

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Pilot control center</h1>
              <p className="mt-1 text-sm text-slate-600">
                Founder-led workflow for who just joined the pool, which roles need a shortlist, and where intros need follow-up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/pilot-review" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Review concierge students
              </Link>
              <Link href="/admin/internships" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Open listings
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCard({
            label: 'Students in pool',
            value: String(studentsInPool),
            hint: 'Concierge intake completed',
            icon: Users,
          })}
          {metricCard({
            label: 'Students matched',
            value: String(studentsMatched),
            hint: 'At least one active pilot stage',
            icon: Users,
          })}
          {metricCard({
            label: 'Active roles',
            value: String(activeRoles),
            hint: 'Published or active pilot listings',
            icon: Briefcase,
          })}
          {metricCard({
            label: 'Intros pending',
            value: String(introsPending),
            hint: 'Introductions sent and awaiting reply',
            icon: Mail,
          })}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Immediate Action</h2>
            <p className="mt-1 text-sm text-slate-600">Start with the founder tasks that move the pilot forward right now.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {actionCard({
              title: 'New Concierge Students',
              count: conciergeStudents.filter((student) => (applicationsByStudent.get(student.user_id) ?? []).length === 0).length,
              hint: 'Joined the pool but not yet matched to any pilot listing.',
              href: '/admin/pilot-review',
              cta: 'Review students',
              preview:
                newConciergeStudents.length === 0 ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">No unassigned concierge students right now.</p>
                ) : (
                  <div className="space-y-2">
                    {newConciergeStudents.map((student) => (
                      <div key={student.user_id} className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">{student.school ?? 'School not set'}</div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          {formatMajor(student.majors)} · joined {formatDateTime(student.concierge_intake_completed_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ),
            })}

            {actionCard({
              title: 'Listings Needing Shortlist',
              count: activePilotListings.filter((listing) => {
                const rows = applicationsByInternship.get(listing.id) ?? []
                return !rows.some((row) => row.pilot_stage === 'shortlist')
              }).length,
              hint: 'Pilot listings with zero shortlisted candidates so far.',
              href: '/admin/pilot-review',
              cta: 'Build shortlists',
              preview:
                listingsNeedingShortlist.length === 0 ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Every active pilot role already has a shortlist started.</p>
                ) : (
                  <div className="space-y-2">
                    {listingsNeedingShortlist.map((listing) => (
                      <div key={listing.id} className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900">{listing.title ?? 'Untitled role'}</div>
                          <Link href={`/admin/internships/${encodeURIComponent(listing.id)}/shortlist`} className="text-xs font-medium text-blue-700 hover:underline">
                            Open
                          </Link>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">{listing.company_name ?? 'Unknown employer'}</div>
                      </div>
                    ))}
                  </div>
                ),
            })}

            {actionCard({
              title: 'Intros Awaiting Employer Reply',
              count: introsPending,
              hint: 'Current intro-sent applications still waiting for a response.',
              href: '/admin/internships',
              cta: 'Follow up',
              preview:
                introsAwaitingReply.length === 0 ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">No pending intro follow-ups.</p>
                ) : (
                  <div className="space-y-2">
                    {introsAwaitingReply.map((application) => {
                      const listing = listingById.get(application.internship_id)
                      return (
                        <div key={application.id} className="rounded-lg border border-slate-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-slate-900">{listing?.title ?? 'Untitled role'}</div>
                            <Link
                              href={`/admin/internships/${encodeURIComponent(application.internship_id)}/applicants?status=introduced`}
                              className="text-xs font-medium text-blue-700 hover:underline"
                            >
                              Open
                            </Link>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            {listing?.company_name ?? 'Unknown employer'} · intro sent {formatDateTime(application.submitted_at ?? application.created_at)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ),
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Active Pilot Matches</h2>
              <p className="mt-1 text-sm text-slate-600">
                Roles already in motion, ordered so shortlisting and follow-up stay visible.
              </p>
            </div>
          </div>

          {activeMatches.length === 0 ? (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No pilot matches are active yet. Start by reviewing concierge students or opening a shortlist.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Employer</th>
                    <th className="px-3 py-2">Candidates sent</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Next action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMatches.map((match) => (
                    <tr key={match.internshipId}>
                      <td className="px-3 py-3 font-medium text-slate-900">{match.role}</td>
                      <td className="px-3 py-3 text-slate-700">{match.employer}</td>
                      <td className="px-3 py-3 text-slate-700">{match.candidatesSent}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {match.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={match.nextActionHref} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                          {match.nextActionLabel}
                          <span aria-hidden>→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
