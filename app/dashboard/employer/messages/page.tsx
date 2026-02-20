import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import EmployerWorkspaceNav from '@/components/employer/EmployerWorkspaceNav'

type SearchParams = Promise<{ internship_id?: string }>

type NotificationRow = {
  id: string
  type: string | null
  title: string | null
  body: string | null
  href: string | null
  created_at: string | null
}

type ApplicationRollupRow = {
  internship_id: string
  created_at: string | null
  internship?: { title?: string | null } | Array<{ title?: string | null }> | null
}

type InternshipRow = {
  id: string
  title: string | null
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return 'Date n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date n/a'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function internshipTitle(value: ApplicationRollupRow['internship']) {
  if (!value) return 'Internship'
  const first = Array.isArray(value) ? value[0] : value
  return first?.title?.trim() || 'Internship'
}

export default async function EmployerMessagesPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const selectedInternshipId = String(resolvedSearchParams?.internship_id ?? '').trim()
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/messages' })
  const supabase = await supabaseServer()

  const [{ data: internshipsData }, { data: notificationsData }] = await Promise.all([
    supabase.from('internships').select('id, title').eq('employer_id', user.id).limit(200),
    supabase
      .from('notifications')
      .select('id, type, title, body, href, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const internships = (internshipsData ?? []) as InternshipRow[]
  const internshipIds = internships.map((row) => row.id)
  const activeInternshipId =
    selectedInternshipId && internshipIds.includes(selectedInternshipId) ? selectedInternshipId : (internshipIds[0] ?? '')
  const scopedInternshipIds = activeInternshipId ? [activeInternshipId] : internshipIds
  const { data: applicationsData } =
    scopedInternshipIds.length > 0
      ? await supabase
          .from('applications')
          .select('internship_id, created_at, internship:internships(title)')
          .in('internship_id', scopedInternshipIds)
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: [] as ApplicationRollupRow[] }

  const notifications = (notificationsData ?? []) as NotificationRow[]
  const applicationRows = (applicationsData ?? []) as ApplicationRollupRow[]
  const latestByInternship = new Map<string, ApplicationRollupRow>()
  for (const row of applicationRows) {
    if (!row.internship_id || latestByInternship.has(row.internship_id)) continue
    latestByInternship.set(row.internship_id, row)
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-4">
          <Link
            href="/dashboard/employer/applicants"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Messages</h1>
          <p className="mt-1 text-sm text-slate-600">Communication and updates are grouped here so the applicant inbox can stay focused on ATS processing.</p>
        </div>

        <EmployerWorkspaceNav
          activeTab="messages"
          selectedInternshipId={activeInternshipId || undefined}
          internships={internships.map((row) => ({ id: row.id, title: row.title?.trim() || 'Internship' }))}
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <p className="mt-1 text-xs text-slate-600">Application and ATS updates from your listings.</p>
            <div className="mt-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No notifications yet.</div>
              ) : (
                notifications.map((item) => (
                  <article key={item.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="text-sm font-medium text-slate-900">{item.title || item.type || 'Notification'}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{item.body || 'No details provided.'}</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{formatTimestamp(item.created_at)}</span>
                      <Link href={item.href || '/notifications'} className="font-medium text-blue-700 hover:underline">
                        Open
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Applications</h2>
            <p className="mt-1 text-xs text-slate-600">Open applicant views by listing for follow-up and review context.</p>
            <div className="mt-3 space-y-2">
              {latestByInternship.size === 0 ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">No applications yet.</div>
              ) : (
                Array.from(latestByInternship.values()).map((row) => (
                  <article key={row.internship_id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="text-sm font-medium text-slate-900">{internshipTitle(row.internship)}</div>
                    <div className="mt-0.5 text-xs text-slate-600">Latest activity: {formatTimestamp(row.created_at)}</div>
                    <div className="mt-1">
                      <Link
                        href={`/dashboard/employer/applicants?internship_id=${encodeURIComponent(row.internship_id)}`}
                        className="text-xs font-medium text-blue-700 hover:underline"
                      >
                        Open applicants
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
