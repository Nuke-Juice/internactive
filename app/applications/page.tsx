import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { FileText, ShieldCheck } from 'lucide-react'

const steps = ['submitted', 'reviewing', 'interview', 'accepted'] as const
type Status = (typeof steps)[number] | 'rejected' | 'viewed'

const stageLabels = ['Submitted', 'Viewed', 'Interview', 'Accepted']

function normalizedStatus(status: Status) {
  if (status === 'viewed') return 'reviewing'
  return status
}

function stageIndex(status: Status) {
  const normalized = normalizedStatus(status)
  return steps.indexOf(normalized as (typeof steps)[number])
}

function StageStepper({ status }: { status: Status }) {
  const index = stageIndex(status)
  const rejected = status === 'rejected'

  return (
    <div className="mt-4">
      <div className="grid grid-cols-4 gap-2">
        {stageLabels.map((label, idx) => {
          const completed = !rejected && idx < index
          const active = !rejected && idx === index
          const muted = rejected || idx > index
          return (
            <div key={label} className="flex flex-col items-center gap-1 text-center">
              <div
                className={`grid h-8 w-8 place-items-center rounded-full border text-[11px] font-semibold ${
                  completed
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                    : active
                      ? 'border-blue-300 bg-blue-100 text-blue-800'
                      : muted
                        ? 'border-slate-200 bg-slate-100 text-slate-500'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                {completed ? '✓' : idx + 1}
              </div>
              <div className={`text-[11px] ${active ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</div>
            </div>
          )
        })}
      </div>
      {rejected ? (
        <p className="mt-2 text-xs text-slate-600">This application was closed by the employer.</p>
      ) : null}
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<string, string> = {
    submitted: 'bg-slate-50 text-slate-700 border-slate-200',
    reviewing: 'bg-blue-50 text-blue-700 border-blue-200',
    viewed: 'bg-blue-50 text-blue-700 border-blue-200',
    interview: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function formatDate(value: string | null) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function parseReasons(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 2)
}

function formatDateTime(value: string | null) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default async function ApplicationsPage() {
  async function markExternalComplete(formData: FormData) {
    'use server'

    const applicationId = String(formData.get('application_id') ?? '').trim()
    const listingId = String(formData.get('listing_id') ?? '').trim()
    if (!applicationId || !listingId) {
      redirect('/applications?error=Missing+application+context')
    }

    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()
    if (!currentUser) redirect('/login')

    const { error } = await supabaseAction
      .from('applications')
      .update({ external_apply_completed_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('student_id', currentUser.id)
      .eq('internship_id', listingId)

    if (error) {
      redirect(`/applications?error=${encodeURIComponent(error.message)}`)
    }

    await trackAnalyticsEvent({
      eventName: 'external_apply_completed',
      userId: currentUser.id,
      properties: { listing_id: listingId, application_id: applicationId, source: 'applications_page' },
    })

    redirect('/applications?toast=External+application+marked+complete.&toast_type=success')
  }

  const { user } = await requireRole('student', { requestedPath: '/applications' })
  const supabase = await supabaseServer()

  const { data: applications } = await supabase
    .from('applications')
    .select(
      'id, status, created_at, submitted_at, employer_viewed_at, match_score, match_reasons, external_apply_required, external_apply_completed_at, external_apply_clicks, external_apply_last_clicked_at, internship:internships(id, title, company_name, apply_mode, external_apply_url)'
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const pendingExternal = (applications ?? []).filter((application) => {
    const listing = application.internship as { external_apply_url?: string | null } | null
    return Boolean(application.external_apply_required) && !application.external_apply_completed_at && Boolean(normalizeExternalApplyUrl(listing?.external_apply_url ?? null))
  })

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
            <p className="mt-2 text-slate-600">Track status at a glance.</p>
          </div>
        </div>
        {pendingExternal.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">Finish your ATS applications</div>
            <p className="mt-1 text-xs text-amber-800">
              {pendingExternal.length} application{pendingExternal.length === 1 ? '' : 's'} still need completion on employer sites.
            </p>
          </div>
        ) : null}
        {(applications ?? []).length > 0 ? (
          <div>
            {(applications ?? [])
              .filter((application) => {
                const listing = application.internship as { external_apply_url?: string | null } | null
                return Boolean(application.external_apply_required) && !application.external_apply_completed_at && Boolean(normalizeExternalApplyUrl(listing?.external_apply_url ?? null))
              })
              .map((application) => {
                const listing = application.internship as { id?: string | null; title?: string | null; company_name?: string | null; external_apply_url?: string | null } | null
                const listingId = String(listing?.id ?? '')
                const externalHref = `/apply/${encodeURIComponent(listingId)}/external?application=${encodeURIComponent(application.id)}`
                return (
                  <div key={`pending-${application.id}`} className="rounded-xl border border-amber-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">{listing?.title || 'Internship'}</div>
                    <div className="text-xs text-slate-600">{listing?.company_name || 'Company'} • Pending ATS completion</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={externalHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Finish application
                      </a>
                      <form action={markExternalComplete}>
                        <input type="hidden" name="application_id" value={application.id} />
                        <input type="hidden" name="listing_id" value={listingId} />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          I finished
                        </button>
                      </form>
                    </div>
                  </div>
                )
              })}
          </div>
        ) : null}

        {!applications || applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            You have not submitted any applications yet.
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((a) => {
              const listing = a.internship as { title?: string | null; company_name?: string | null } | null
              const status = (a.status ?? 'submitted') as Status
              const topReasons = parseReasons(a.match_reasons)
              const pendingExternalApply = Boolean(a.external_apply_required) && !a.external_apply_completed_at
              const companyInitial = (listing?.company_name ?? 'C').trim().charAt(0).toUpperCase()
              const lastActivity =
                formatDateTime(a.employer_viewed_at ?? null) ??
                formatDateTime(a.external_apply_last_clicked_at ?? null) ??
                formatDateTime(a.submitted_at ?? a.created_at)
              return (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600">
                        {companyInitial}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold text-slate-900">
                          {listing?.title || 'Internship'}
                        </div>
                        <div className="text-sm text-slate-600">
                          {listing?.company_name || 'Company'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Applied {formatDate(a.submitted_at ?? a.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill status={status} />
                    </div>
                  </div>
                  {pendingExternalApply ? (
                    <div className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                      Pending external ATS completion
                    </div>
                  ) : null}

                  <StageStepper status={status} />

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      Last activity: {lastActivity ?? 'No activity yet'}
                    </span>
                    {typeof a.match_score === 'number' ? (
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Match: {a.match_score}
                      </span>
                    ) : null}
                  </div>

                  {topReasons.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-xs">
                      {topReasons.map((reason) => (
                        <li key={reason} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
