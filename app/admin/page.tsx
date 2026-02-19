import Link from 'next/link'
import { Bell, Mail, ShieldCheck, Star, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type InternshipRow = {
  id: string
  title: string | null
  company_name: string | null
  status: string | null
  is_active: boolean | null
  created_at: string | null
  pay_min: number | null
  pay_max: number | null
  hours_min: number | null
  hours_max: number | null
  location_city: string | null
  location_state: string | null
  work_mode: string | null
}

type EmployerRow = {
  user_id: string
  company_name: string | null
  contact_email: string | null
}

type StudentRow = {
  user_id: string
  school: string | null
  year: string | null
  majors: string[] | string | null
  availability_hours_per_week: number | null
}

function formatWhen(value: string | null) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleDateString()
}

function formatRange(min: number | null, max: number | null, suffix: string) {
  if (typeof min === 'number' && typeof max === 'number') return `${min}-${max} ${suffix}`
  return 'Not set'
}

function formatLocation(row: InternshipRow) {
  if (row.work_mode === 'remote') return 'Remote'
  if (row.location_city && row.location_state) return `${row.location_city}, ${row.location_state}`
  if (row.location_state) return row.location_state
  return 'Not set'
}

function majorLabel(value: StudentRow['majors']) {
  if (Array.isArray(value)) return value[0] ?? 'Major not set'
  if (typeof value === 'string' && value.trim()) return value
  return 'Major not set'
}

function statCard(input: { label: string; value: string; hint: string; icon: ComponentType<{ className?: string }> }) {
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

export default async function AdminDashboardPage() {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin' })

  if (!hasSupabaseAdminCredentials()) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8">
        <section className="mx-auto max-w-7xl space-y-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Admin operations hub</h1>
            <p className="mt-1 text-sm text-slate-600">Fast access to moderation, employers, students, and matching tools.</p>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Missing `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/listings-queue" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Listings queue</Link>
            <Link href="/admin/internships" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Manage internships</Link>
            <Link href="/admin/internships/new" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">New internship</Link>
            <Link href="/admin/employers" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Manage employers</Link>
            <Link href="/admin/students" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Manage students</Link>
            <Link href="/admin/matching/preview" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Matching preview</Link>
          </div>
        </section>
      </main>
    )
  }

  const admin = supabaseAdmin()

  const [internshipsResult, employersResult, studentsResult] = await Promise.all([
    admin
      .from('internships')
      .select(
        'id, title, company_name, status, is_active, created_at, pay_min, pay_max, hours_min, hours_max, location_city, location_state, work_mode'
      )
      .order('created_at', { ascending: false })
      .limit(250),
    admin.from('employer_profiles').select('user_id, company_name, contact_email').limit(250),
    admin.from('student_profiles').select('user_id, school, year, majors, availability_hours_per_week').limit(250),
  ])

  const internships = (internshipsResult.data ?? []) as InternshipRow[]
  const employers = (employersResult.data ?? []) as EmployerRow[]
  const students = (studentsResult.data ?? []) as StudentRow[]

  const pendingRows = internships.filter((row) => row.status === 'pending_review' || row.status === 'draft').slice(0, 8)
  const activeRows = internships.filter((row) => row.status === 'published' || row.is_active).slice(0, 8)
  const gapRows = internships
    .filter((row) => {
      const missingPay = !(typeof row.pay_min === 'number' && typeof row.pay_max === 'number')
      const missingHours = !(typeof row.hours_min === 'number' && typeof row.hours_max === 'number')
      const missingLocation = row.work_mode !== 'remote' && !row.location_city && !row.location_state
      return missingPay || missingHours || missingLocation
    })
    .slice(0, 8)

  const employersMissingContact = employers.filter((row) => !row.contact_email?.trim()).slice(0, 8)
  const studentsNeedingProfileData = students
    .filter((row) => {
      const hasMajor = Array.isArray(row.majors) ? row.majors.length > 0 : Boolean(row.majors?.trim())
      const hasYear = Boolean(row.year?.trim())
      const hasHours = typeof row.availability_hours_per_week === 'number' && row.availability_hours_per_week > 0
      return !hasMajor || !hasYear || !hasHours
    })
    .slice(0, 8)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Admin operations hub</h1>
          <p className="mt-1 text-sm text-slate-600">
            One-screen triage for listings, employers, students, and matching tools.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCard({ label: 'Pending listings', value: String(internships.filter((row) => row.status === 'pending_review' || row.status === 'draft').length), hint: 'Needs moderation now', icon: Bell })}
            {statCard({ label: 'Active listings', value: String(internships.filter((row) => row.status === 'published' || row.is_active).length), hint: 'Live and visible', icon: ShieldCheck })}
            {statCard({ label: 'Employers', value: String(employers.length), hint: `${employers.filter((row) => !row.contact_email?.trim()).length} missing contact email`, icon: Mail })}
            {statCard({ label: 'Students', value: String(students.length), hint: `${studentsNeedingProfileData.length} need profile completion`, icon: Users })}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Needs review now</h2>
              <Link href="/admin/listings-queue?tab=pending" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                Open queue
              </Link>
            </div>
            <div className="space-y-2">
              {pendingRows.length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">No pending listings.</p>
              ) : (
                pendingRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{row.title ?? 'Untitled internship'}</div>
                      <Link href={`/admin/internships/${row.id}`} className="text-xs font-medium text-blue-700 hover:underline">Open</Link>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">{row.company_name ?? 'Unknown company'} · {formatWhen(row.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Published recently</h2>
              <Link href="/admin/internships" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                Manage listings
              </Link>
            </div>
            <div className="space-y-2">
              {activeRows.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No published listings found.</p>
              ) : (
                activeRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{row.title ?? 'Untitled internship'}</div>
                      <Link href={`/admin/internships/${row.id}`} className="text-xs font-medium text-blue-700 hover:underline">Open</Link>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">{row.company_name ?? 'Unknown company'} · {formatLocation(row)} · {formatRange(row.pay_min, row.pay_max, '/hr')}</div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Listing data gaps</h2>
              <Link href="/admin/listings-queue?tab=flagged" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                Review flagged
              </Link>
            </div>
            <div className="space-y-2">
              {gapRows.length === 0 ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">No obvious listing gaps detected.</p>
              ) : (
                gapRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">{row.title ?? 'Untitled internship'}</div>
                      <Link href={`/admin/internships/${row.id}`} className="font-medium text-blue-700 hover:underline">Fix</Link>
                    </div>
                    <div className="mt-1">Pay: {formatRange(row.pay_min, row.pay_max, '/hr')} · Hours: {formatRange(row.hours_min, row.hours_max, 'h/wk')} · Location: {formatLocation(row)}</div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">People requiring follow-up</h2>
              <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Star className="h-3.5 w-3.5" />
                Fast triage
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Employers missing contact email</div>
                {employersMissingContact.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No missing contact emails.</p>
                ) : (
                  employersMissingContact.map((row) => (
                    <div key={row.user_id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-900">{row.company_name ?? 'Unnamed employer'}</span>
                        <Link href={`/admin/employers?edit=${encodeURIComponent(row.user_id)}`} className="text-xs font-medium text-blue-700 hover:underline">Contact</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Students with incomplete profile signals</div>
                {studentsNeedingProfileData.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No obvious profile gaps.</p>
                ) : (
                  studentsNeedingProfileData.map((row) => (
                    <div key={row.user_id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-900">{majorLabel(row.majors)} · {row.school ?? 'School not set'}</span>
                        <Link href={`/admin/students?q=${encodeURIComponent(row.user_id)}`} className="text-xs font-medium text-blue-700 hover:underline">Open</Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </section>

      </section>
    </main>
  )
}
