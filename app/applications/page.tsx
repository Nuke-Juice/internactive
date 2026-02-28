import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeEmployerAtsDefaultMode, resolveEffectiveAtsConfig, type EmployerAtsDefaults } from '@/lib/apply/effectiveAts'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { dispatchInAppNotification } from '@/lib/notifications/dispatcher'

type Status = 'submitted' | 'reviewing' | 'interview' | 'accepted' | 'rejected' | 'withdrawn' | 'viewed'

type ApplicationRow = {
  id: string
  internship_id: string
  status: string | null
  created_at: string | null
  submitted_at: string | null
  employer_viewed_at: string | null
  quick_apply_note: string | null
  ats_invite_status: string | null
  ats_invited_at: string | null
  ats_invite_message: string | null
  external_apply_required: boolean | null
  external_apply_completed_at: string | null
  external_apply_clicks: number | null
  external_apply_last_clicked_at: string | null
  internship:
    | {
        id?: string | null
        title?: string | null
        company_name?: string | null
        employer_id?: string | null
        apply_mode?: string | null
        ats_stage_mode?: string | null
        external_apply_url?: string | null
        external_apply_type?: string | null
        use_employer_ats_defaults?: boolean | null
      }
    | null
}

type MessageRow = {
  id: string
  application_id: string
  sender_user_id: string
  body: string
  created_at: string | null
}

type ApplicationFilter = 'submitted' | 'viewed' | 'reviewing' | 'interview' | 'accepted'

function asStatus(value: string | null | undefined): Status {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'reviewing' || normalized === 'interview' || normalized === 'accepted' || normalized === 'rejected' || normalized === 'withdrawn' || normalized === 'viewed') return normalized
  return 'submitted'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleString()
}

function normalizeInviteStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (['invited', 'clicked', 'self_reported_complete', 'employer_confirmed'].includes(normalized)) return normalized
  return 'not_invited'
}

function normalizeApplicationFilter(value: string | null | undefined): ApplicationFilter | null {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'submitted' || normalized === 'viewed' || normalized === 'reviewing' || normalized === 'interview' || normalized === 'accepted') {
    return normalized
  }
  return null
}

function matchesApplicationFilter(application: ApplicationRow, filter: ApplicationFilter | null) {
  if (!filter) return true
  if (filter === 'viewed') {
    return application.status === 'reviewing' || application.employer_viewed_at !== null
  }
  return asStatus(application.status) === filter
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; application?: string }>
}) {
  async function markExternalComplete(formData: FormData) {
    'use server'

    const applicationId = String(formData.get('application_id') ?? '').trim()
    if (!applicationId) {
      redirect('/applications?error=Missing+application+context')
    }

    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()
    if (!currentUser) redirect('/login')

    const { data: updatedRow, error } = await supabaseAction.rpc('student_mark_ats_invite_complete', {
      in_application_id: applicationId,
    })
    if (error) {
      redirect(`/applications?error=${encodeURIComponent(error.message)}`)
    }

    const row = (Array.isArray(updatedRow) ? updatedRow[0] : updatedRow) as { internship_id?: string | null } | null
    const listingId = row?.internship_id ?? null
    if (listingId) {
      await trackAnalyticsEvent({
        eventName: 'external_apply_completed',
        userId: currentUser.id,
        properties: { listing_id: listingId, application_id: applicationId, source: 'applications_page' },
      })

      if (hasSupabaseAdminCredentials()) {
        const admin = supabaseAdmin()
        const { data: internshipRow } = await admin
          .from('internships')
          .select('employer_id')
          .eq('id', listingId)
          .maybeSingle()
        const employerId = (internshipRow as { employer_id?: string | null } | null)?.employer_id ?? null
        if (employerId) {
          try {
            await dispatchInAppNotification({
              userId: employerId,
              type: 'ats_completed_self_reported',
              title: 'ATS completion reported',
              body: 'A candidate marked their ATS application as submitted.',
              href: `/dashboard/employer/applicants?internship_id=${encodeURIComponent(listingId)}`,
              metadata: { listing_id: listingId, application_id: applicationId },
            })
          } catch (dispatchError) {
            console.warn('[notifications] ats_completed_self_reported dispatch failed', dispatchError)
          }
        }
      }
    }

    redirect('/applications?toast=External+application+marked+complete.&toast_type=success')
  }

  async function sendMessageAction(formData: FormData) {
    'use server'

    const applicationId = String(formData.get('application_id') ?? '').trim()
    const body = String(formData.get('message_body') ?? '').trim().slice(0, 2000)
    if (!applicationId || !body) {
      redirect('/applications?error=Message+text+is+required')
    }

    const supabaseAction = await supabaseServer()
    const {
      data: { user: currentUser },
    } = await supabaseAction.auth.getUser()
    if (!currentUser) redirect('/login')

    if (!hasSupabaseAdminCredentials()) {
      redirect('/applications?error=Messaging+temporarily+unavailable')
    }

    const admin = supabaseAdmin()
    const { data: application } = await admin
      .from('applications')
      .select('id, student_id, internship_id, internship:internships!inner(employer_id)')
      .eq('id', applicationId)
      .maybeSingle()

    if (!application?.id || application.student_id !== currentUser.id) {
      redirect('/applications?error=Not+authorized+to+message+for+this+application')
    }

    const employerId = ((application.internship as { employer_id?: string | null } | null)?.employer_id ?? '').trim()
    if (!employerId) {
      redirect('/applications?error=Employer+thread+could+not+be+resolved')
    }

    const { error: insertError } = await admin.from('application_messages').insert({
      application_id: applicationId,
      sender_user_id: currentUser.id,
      recipient_user_id: employerId,
      body,
    })
    if (insertError) {
      redirect(`/applications?error=${encodeURIComponent(insertError.message)}`)
    }

    try {
      await dispatchInAppNotification({
        userId: employerId,
        type: 'message_received',
        title: 'New message from candidate',
        body: body.length > 120 ? `${body.slice(0, 117)}...` : body,
        href: '/dashboard/employer/applicants',
        metadata: { application_id: applicationId, internship_id: application.internship_id },
      })
    } catch (dispatchError) {
      console.warn('[notifications] message_received dispatch failed', dispatchError)
    }

    redirect('/applications?toast=Message+sent.&toast_type=success')
  }

  const { user } = await requireRole('student', { requestedPath: '/applications' })
  const supabase = await supabaseServer()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeFilter = normalizeApplicationFilter(resolvedSearchParams?.status)
  const selectedApplicationId = String(resolvedSearchParams?.application ?? '').trim()

  const { data: rawApplications } = await supabase
    .from('applications')
    .select(
      'id, internship_id, status, created_at, submitted_at, employer_viewed_at, quick_apply_note, ats_invite_status, ats_invited_at, ats_invite_message, external_apply_required, external_apply_completed_at, external_apply_clicks, external_apply_last_clicked_at, internship:internships(id, title, company_name, employer_id, apply_mode, ats_stage_mode, external_apply_url, external_apply_type, use_employer_ats_defaults)'
    )
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })

  const applications = (rawApplications ?? []) as ApplicationRow[]

  const { data: rawMessages } =
    applications.length > 0
      ? await supabase
          .from('application_messages')
          .select('id, application_id, sender_user_id, body, created_at')
          .in('application_id', applications.map((row) => row.id))
          .order('created_at', { ascending: true })
      : { data: [] as MessageRow[] }

  const messagesByApplicationId = new Map<string, MessageRow[]>()
  for (const row of (rawMessages ?? []) as MessageRow[]) {
    const list = messagesByApplicationId.get(row.application_id) ?? []
    list.push(row)
    messagesByApplicationId.set(row.application_id, list)
  }

  const employerIds = Array.from(
    new Set(applications.map((application) => application.internship?.employer_id).filter((value): value is string => Boolean(value)))
  )
  const { data: employerSettingsData } =
    employerIds.length > 0
      ? await supabase
          .from('employer_settings')
          .select('employer_id, default_ats_stage_mode, default_external_apply_url, default_external_apply_type')
          .in('employer_id', employerIds)
      : { data: [] as Array<{ employer_id: string; default_ats_stage_mode: string | null; default_external_apply_url: string | null; default_external_apply_type: string | null }> }
  const employerSettingsByEmployerId = new Map(
    (employerSettingsData ?? []).map((row) => [row.employer_id, row] as const)
  )

  const pendingInvites = applications.filter((application) => {
    const inviteStatus = normalizeInviteStatus(application.ats_invite_status)
    const employerSettings = application.internship?.employer_id
      ? employerSettingsByEmployerId.get(application.internship.employer_id)
      : undefined
    const employerDefaults: EmployerAtsDefaults = {
      defaultAtsStageMode: normalizeEmployerAtsDefaultMode(employerSettings?.default_ats_stage_mode),
      defaultExternalApplyUrl: employerSettings?.default_external_apply_url ?? null,
      defaultExternalApplyType: employerSettings?.default_external_apply_type === 'redirect' ? 'redirect' : 'new_tab',
    }
    const effectiveAts = resolveEffectiveAtsConfig({
      internship: {
        applyMode: application.internship?.apply_mode,
        atsStageMode: application.internship?.ats_stage_mode,
        externalApplyUrl: application.internship?.external_apply_url,
        externalApplyType: application.internship?.external_apply_type,
        useEmployerAtsDefaults: application.internship?.use_employer_ats_defaults !== false,
      },
      employerDefaults,
    })
    return ['invited', 'clicked', 'self_reported_complete'].includes(inviteStatus) &&
      Boolean(application.external_apply_required) &&
      !application.external_apply_completed_at &&
      Boolean(effectiveAts.externalApplyUrl)
  })
  const submittedCount = applications.filter((application) => asStatus(application.status) === 'submitted').length
  const reviewingCount = applications.filter((application) => asStatus(application.status) === 'reviewing').length
  const interviewCount = applications.filter((application) => asStatus(application.status) === 'interview').length
  const acceptedCount = applications.filter((application) => asStatus(application.status) === 'accepted').length
  const filteredApplications = applications.filter((application) => matchesApplicationFilter(application, activeFilter))

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
          <p className="mt-2 text-slate-600">Track your application status, ATS invites, and messages in one place.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Submitted', count: submittedCount, href: '/applications?status=submitted' },
            { label: 'Reviewing', count: reviewingCount, href: '/applications?status=reviewing' },
            { label: 'Interview', count: interviewCount, href: '/applications?status=interview' },
            { label: 'Accepted', count: acceptedCount, href: '/applications?status=accepted' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{item.count}</div>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/applications"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === null ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            All applications
          </Link>
          <Link
            href="/applications?status=submitted"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === 'submitted' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Submitted
          </Link>
          <Link
            href="/applications?status=viewed"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === 'viewed' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Viewed / Reviewing
          </Link>
          <Link
            href="/applications?status=interview"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === 'interview' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Interview
          </Link>
          <Link
            href="/applications?status=accepted"
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeFilter === 'accepted' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Accepted
          </Link>
        </div>

        {pendingInvites.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-semibold text-amber-900">Invites to complete employer application</div>
            <p className="mt-1 text-xs text-amber-800">
              {pendingInvites.length} application{pendingInvites.length === 1 ? '' : 's'} waiting for your ATS completion.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              You’ve been selected to move forward. Complete the employer’s official application to stay in consideration.
            </p>
          </div>
        ) : null}

        {pendingInvites.map((application) => {
          const listingId = String(application.internship?.id ?? application.internship_id)
          const externalHref = `/apply/${encodeURIComponent(listingId)}/external?application=${encodeURIComponent(application.id)}`
          return (
            <div key={`pending-${application.id}`} className="rounded-xl border border-amber-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">{application.internship?.title || 'Internship'}</div>
              <div className="text-xs text-slate-600">{application.internship?.company_name || 'Company'} • Top-candidate ATS invite</div>
              {application.ats_invite_message ? (
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900">
                  Employer note: {application.ats_invite_message}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Complete employer application
                </a>
                <form action={markExternalComplete}>
                  <input type="hidden" name="application_id" value={application.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    I submitted
                  </button>
                </form>
              </div>
            </div>
          )
        })}

        {applications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            You have not submitted any applications yet.
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No applications match this filter. <Link href="/applications" className="font-medium text-slate-900 underline-offset-2 hover:underline">View all</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Application threads</h2>
              <div className="text-xs text-slate-500">
                {filteredApplications.length}
                {activeFilter ? ' shown' : ' total'}
              </div>
            </div>
            {filteredApplications.map((application) => {
              const status = asStatus(application.status)
              const inviteStatus = normalizeInviteStatus(application.ats_invite_status)
              const messages = messagesByApplicationId.get(application.id) ?? []
              const listingId = String(application.internship?.id ?? application.internship_id)
              const isSelected = selectedApplicationId === application.id

              return (
                <div
                  key={application.id}
                  id={`application-${application.id}`}
                  className={`rounded-2xl border bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm ${
                    isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{application.internship?.title || 'Internship'}</div>
                      <div className="text-sm text-slate-600">{application.internship?.company_name || 'Company'}</div>
                      <div className="mt-1 text-xs text-slate-500">Applied {formatDate(application.submitted_at ?? application.created_at)}</div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">{status}</span>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">ATS invite status: {inviteStatus.replaceAll('_', ' ')}</div>
                  {application.quick_apply_note ? (
                    <div className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      Quick Apply note: {application.quick_apply_note}
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <Link
                      href={`/jobs/${encodeURIComponent(listingId)}#match-details`}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      View match details
                    </Link>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                    <details open={messages.length > 0 || isSelected} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Messages ({messages.length})</span>
                        <span className="text-[11px] normal-case text-slate-500 group-open:hidden">Open</span>
                        <span className="hidden text-[11px] normal-case text-slate-500 group-open:inline">Close</span>
                      </summary>
                      <div className="mt-2 space-y-2">
                        {messages.length === 0 ? (
                          <div className="text-xs text-slate-500">No messages yet.</div>
                        ) : (
                          messages.map((message) => (
                            <div key={message.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                              <div className="font-medium text-slate-700">{message.sender_user_id === user.id ? 'You' : 'Employer'} · {formatDate(message.created_at)}</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-800">{message.body}</div>
                            </div>
                          ))
                        )}
                      </div>
                      <form action={sendMessageAction} className="mt-3 space-y-2">
                        <input type="hidden" name="application_id" value={application.id} />
                        <textarea
                          name="message_body"
                          rows={2}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                          placeholder="Message employer..."
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Message employer
                        </button>
                      </form>
                    </details>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
