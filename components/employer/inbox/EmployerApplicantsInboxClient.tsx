'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/ToastProvider'

type InviteStatus = 'not_invited' | 'invited' | 'clicked' | 'self_reported_complete' | 'employer_confirmed'
type ExportScope = 'current' | 'all'

type ApplicantRow = {
  applicationId: string
  internshipId: string
  internshipTitle: string
  studentId: string
  studentName: string
  school: string
  major: string
  quickApplyNote: string | null
  atsInviteStatus: InviteStatus
  externalApplyCompletedAt: string | null
}

type InternshipOption = {
  internshipId: string
  title: string
}

type SelectedInternshipConfig = {
  internshipId: string
  title: string
  applyMode: string | null
  atsStageMode: string | null
  externalApplyUrl: string | null
  externalApplyType: string | null
}

type TabKey = 'new' | 'invited' | 'completed' | 'finalists'

function statusBadge(status: InviteStatus) {
  if (status === 'invited') return 'border-blue-200 bg-blue-50 text-blue-800'
  if (status === 'clicked') return 'border-indigo-200 bg-indigo-50 text-indigo-800'
  if (status === 'self_reported_complete') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (status === 'employer_confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function displayStatus(status: InviteStatus) {
  if (status === 'not_invited') return 'Not invited'
  if (status === 'self_reported_complete') return 'Self-reported completed'
  if (status === 'employer_confirmed') return 'Confirmed'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function tabForStatus(status: InviteStatus): TabKey {
  if (status === 'not_invited') return 'new'
  if (status === 'invited' || status === 'clicked') return 'invited'
  if (status === 'self_reported_complete') return 'completed'
  return 'finalists'
}

function parseContentDispositionFileName(value: string | null) {
  if (!value) return null
  const match = value.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? null
}

async function readErrorMessage(response: Response) {
  const maybeJson = (await response.json().catch(() => null)) as { error?: string } | null
  if (maybeJson?.error) return maybeJson.error
  return 'Request failed.'
}

function isCuratedMode(config: SelectedInternshipConfig | null) {
  if (!config) return false
  const applyMode = String(config.applyMode ?? '').trim().toLowerCase()
  const atsStageMode = String(config.atsStageMode ?? '').trim().toLowerCase()
  return applyMode === 'hybrid' && (atsStageMode === 'curated' || !atsStageMode)
}

function normalizeDestinationUrl(value: string | null | undefined) {
  const input = String(value ?? '').trim()
  if (!input) return null
  try {
    const parsed = new URL(input)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function destinationLabel(value: string | null | undefined) {
  const normalized = normalizeDestinationUrl(value)
  if (!normalized) return null
  try {
    const parsed = new URL(normalized)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    const shortPath = path.length > 24 ? `${path.slice(0, 24)}...` : path
    return `${parsed.hostname}${shortPath}`
  } catch {
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized
  }
}

async function postAnalyticsEvent(eventName: string, properties: Record<string, unknown>) {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event_name: eventName, properties }),
    })
  } catch {
    // Analytics should not block user actions.
  }
}

export default function EmployerApplicantsInboxClient({
  rows,
  defaultInternshipId,
  internshipOptions,
  selectedInternshipConfig,
}: {
  rows: ApplicantRow[]
  defaultInternshipId?: string
  internshipOptions: InternshipOption[]
  selectedInternshipConfig: SelectedInternshipConfig | null
}) {
  const router = useRouter()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('new')
  const [exportScope, setExportScope] = useState<ExportScope>('current')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteTargetIds, setInviteTargetIds] = useState<string[]>([])
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [messageApplicationId, setMessageApplicationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedInternshipIsCurated = isCuratedMode(selectedInternshipConfig)
  const selectedInternshipApplyMode = String(selectedInternshipConfig?.applyMode ?? '').trim().toLowerCase()
  const selectedInternshipDestination = normalizeDestinationUrl(selectedInternshipConfig?.externalApplyUrl ?? null)
  const selectedInternshipDestinationLabel = destinationLabel(selectedInternshipDestination)
  const selectedInternshipHasAtsConfig =
    selectedInternshipApplyMode !== 'native' && Boolean(selectedInternshipDestination)
  const canInviteForSelectedListing =
    Boolean(defaultInternshipId) && selectedInternshipIsCurated && Boolean(selectedInternshipDestination)
  const inviteDisabledReason = !defaultInternshipId
    ? 'Select a listing to configure ATS before sending invites.'
    : !selectedInternshipIsCurated
      ? 'This listing is not in curated ATS invite mode.'
      : !selectedInternshipDestination
        ? 'Set up ATS to invite candidates.'
        : null

  const tabbedRows = useMemo(() => rows.filter((row) => tabForStatus(row.atsInviteStatus) === activeTab), [rows, activeTab])

  const tabCounts = useMemo(() => {
    return {
      new: rows.filter((row) => tabForStatus(row.atsInviteStatus) === 'new').length,
      invited: rows.filter((row) => tabForStatus(row.atsInviteStatus) === 'invited').length,
      completed: rows.filter((row) => tabForStatus(row.atsInviteStatus) === 'completed').length,
      finalists: rows.filter((row) => tabForStatus(row.atsInviteStatus) === 'finalists').length,
    }
  }, [rows])

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.applicationId)), [rows, selectedIds])

  function buildExportUrl(mode: 'csv' | 'emails' | 'packet_links' | 'summary') {
    const params = new URLSearchParams({ mode, scope: exportScope })
    if (exportScope === 'current') params.set('tab', activeTab)
    if (defaultInternshipId) params.set('internship_id', defaultInternshipId)
    return `/dashboard/employer/applicants/export?${params.toString()}`
  }

  function toggleSelection(applicationId: string) {
    setSelectedIds((prev) => (prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId]))
  }

  function selectAllInTab() {
    setSelectedIds(tabbedRows.map((row) => row.applicationId))
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function openInviteModal(applicationIds: string[]) {
    if (!canInviteForSelectedListing) {
      showToast({ kind: 'warning', message: inviteDisabledReason || 'ATS not configured. Set up ATS to invite candidates.' })
      return
    }
    setInviteTargetIds(applicationIds)
    setInviteMessage('')
    setInviteModalOpen(true)
  }

  async function submitInvite() {
    if (inviteTargetIds.length === 0 || busy || !canInviteForSelectedListing) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/employer/applications/ats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          application_ids: inviteTargetIds,
          message: inviteMessage,
        }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }
      setInviteModalOpen(false)
      setSelectedIds((prev) => prev.filter((id) => !inviteTargetIds.includes(id)))
      showToast({ kind: 'success', message: 'ATS invite sent.' })
      router.refresh()
    } catch (inviteError) {
      const message = inviteError instanceof Error ? inviteError.message : 'Could not send ATS invites.'
      setError(message)
      showToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  async function markConfirmed(applicationId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/employer/applications/ats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', application_ids: [applicationId] }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }
      showToast({ kind: 'success', message: 'Candidate marked confirmed.' })
      router.refresh()
    } catch (confirmError) {
      const message = confirmError instanceof Error ? confirmError.message : 'Could not mark candidate as confirmed.'
      setError(message)
      showToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!messageApplicationId || !messageBody.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/applications/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ application_id: messageApplicationId, body: messageBody.trim() }),
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }
      setMessageModalOpen(false)
      setMessageBody('')
      setMessageApplicationId('')
      showToast({ kind: 'success', message: 'Message sent.' })
      router.refresh()
    } catch (messageError) {
      const message = messageError instanceof Error ? messageError.message : 'Could not send message.'
      setError(message)
      showToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  async function downloadCsv() {
    if (busy) return
    setBusy(true)
    setError(null)
    showToast({ kind: 'success', message: 'Export started.' })

    try {
      const response = await fetch(buildExportUrl('csv'))
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const fileName =
        parseContentDispositionFileName(response.headers.get('content-disposition')) ||
        `internactive_applicants_${new Date().toISOString().slice(0, 10)}.csv`
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)

      showToast({ kind: 'success', message: 'Downloaded.' })
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : 'Export failed.'
      setError(message)
      showToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  async function copyPayload(mode: 'emails' | 'packet_links' | 'summary', successMessage: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(buildExportUrl(mode))
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }
      const payload = (await response.json()) as { text?: string; count?: number; error?: string }
      const text = (payload.text ?? '').trim()
      if (!text) {
        showToast({ kind: 'warning', message: 'No data available for this selection.' })
        return
      }
      await navigator.clipboard.writeText(text)
      showToast({ kind: 'success', message: successMessage })
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : 'Copy failed.'
      setError(message)
      showToast({ kind: 'error', message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Invite candidates to complete your official application (ATS). This reduces noise and sends only top candidates to your ATS.
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Listing</label>
        <select
          value={defaultInternshipId ?? ''}
          onChange={(event) => {
            const internshipId = event.target.value
            const params = new URLSearchParams(window.location.search)
            if (internshipId) {
              params.set('internship_id', internshipId)
            } else {
              params.delete('internship_id')
            }
            const query = params.toString()
            router.push(`/dashboard/employer/applicants${query ? `?${query}` : ''}`)
          }}
          className="min-w-[260px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
        >
          <option value="">All listings</option>
          {internshipOptions.map((option) => (
            <option key={option.internshipId} value={option.internshipId}>
              {option.title}
            </option>
          ))}
        </select>
      </div>

      {defaultInternshipId ? (
        selectedInternshipHasAtsConfig ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="font-medium">ATS configured for this listing: {selectedInternshipDestinationLabel || 'Configured destination'}</div>
            <div className="mt-1 text-xs text-emerald-800">Official application: {selectedInternshipDestinationLabel || selectedInternshipDestination}</div>
            {!selectedInternshipIsCurated ? (
              <div className="mt-1 text-xs text-emerald-800">Invites are available only when the listing is set to curated ATS mode.</div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void postAnalyticsEvent('ats_setup_clicked', {
                  internship_id: defaultInternshipId,
                  source: 'employer_applicants_banner',
                })
                router.push(`/dashboard/employer/new?edit=${encodeURIComponent(defaultInternshipId)}#application-settings`)
              }}
              className="mt-2 inline-flex rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Edit ATS
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-medium">ATS not configured for this listing</div>
            <div className="mt-1 text-xs text-amber-800">To invite candidates, add your official application URL.</div>
            <button
              type="button"
              onClick={() => {
                void postAnalyticsEvent('ats_setup_clicked', {
                  internship_id: defaultInternshipId,
                  source: 'employer_applicants_banner',
                })
                router.push(`/dashboard/employer/new?edit=${encodeURIComponent(defaultInternshipId)}#application-settings`)
              }}
              className="mt-2 inline-flex rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
            >
              Set up ATS
            </button>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-medium">Select a listing to configure ATS</div>
          <div className="mt-1 text-xs text-amber-800">Choose a listing above before sending ATS invites.</div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-xs text-slate-600">
          Export uses <span className="font-medium text-slate-900">{exportScope === 'all' ? 'all applicants' : `current tab (${activeTab})`}</span>.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exportScope}
            onChange={(event) => setExportScope(event.target.value === 'all' ? 'all' : 'current')}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="current">Current filter</option>
            <option value="all">Export all</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void downloadCsv()
            }}
            className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Download CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void copyPayload('emails', 'Emails copied.')
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 disabled:opacity-60"
          >
            Copy emails
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void copyPayload('packet_links', 'Applicant packet links copied.')
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 disabled:opacity-60"
          >
            Copy applicant packet links
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void copyPayload('summary', 'Summary copied.')
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 disabled:opacity-60"
          >
            Copy summary
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['new', `New (${tabCounts.new})`],
          ['invited', `Invited to ATS (${tabCounts.invited})`],
          ['completed', `Completed ATS (${tabCounts.completed})`],
          ['finalists', `Confirmed / Finalists (${tabCounts.finalists})`],
        ] as const).map(([tabKey, label]) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => {
              setActiveTab(tabKey)
              setSelectedIds([])
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              activeTab === tabKey ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectAllInTab} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700">
            Select all in tab
          </button>
          <button type="button" onClick={clearSelection} className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700">
            Clear
          </button>
          <button
            type="button"
            disabled={selectedRows.length === 0}
            aria-disabled={!canInviteForSelectedListing}
            onClick={() => openInviteModal(selectedRows.map((row) => row.applicationId))}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              selectedRows.length === 0 || !canInviteForSelectedListing
                ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'
                : 'border-blue-300 bg-blue-50 text-blue-800'
            }`}
            title={!canInviteForSelectedListing ? (inviteDisabledReason ?? 'Set up ATS to invite candidates.') : undefined}
          >
            Invite selected to ATS
          </button>
          <span className="text-xs text-slate-500">{selectedRows.length} selected</span>
          {!canInviteForSelectedListing ? <span className="text-xs text-amber-700">{inviteDisabledReason}</span> : null}
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Select</th>
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Internship</th>
              <th className="px-3 py-2">Quick Apply note</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tabbedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">No applicants in this tab.</td>
              </tr>
            ) : (
              tabbedRows.map((row) => (
                <tr key={row.applicationId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.applicationId)}
                      onChange={() => toggleSelection(row.applicationId)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{row.studentName}</div>
                    <div className="text-xs text-slate-600">{row.school}</div>
                    <div className="text-xs text-slate-600">{row.major}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.internshipTitle}</td>
                  <td className="px-3 py-3 text-xs text-slate-700">{row.quickApplyNote || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusBadge(row.atsInviteStatus)}`}>
                      {displayStatus(row.atsInviteStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.atsInviteStatus === 'not_invited' ? (
                        <button
                          type="button"
                          aria-disabled={!canInviteForSelectedListing}
                          onClick={() => openInviteModal([row.applicationId])}
                          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                            !canInviteForSelectedListing
                              ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500'
                              : 'border-blue-300 bg-blue-50 text-blue-800'
                          }`}
                          title={!canInviteForSelectedListing ? (inviteDisabledReason ?? 'Set up ATS to invite candidates.') : undefined}
                        >
                          Invite to ATS
                        </button>
                      ) : null}
                      {row.atsInviteStatus === 'self_reported_complete' ? (
                        <button
                          type="button"
                          onClick={() => {
                            void markConfirmed(row.applicationId)
                          }}
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800"
                        >
                          Mark confirmed
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setMessageApplicationId(row.applicationId)
                          setMessageBody('')
                          setMessageModalOpen(true)
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                      >
                        Message
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {inviteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Invite to ATS</h3>
            <p className="mt-1 text-sm text-slate-600">Send ATS invite to {inviteTargetIds.length} candidate(s).</p>
            {selectedInternshipDestination ? (
              <p className="mt-2 text-xs text-slate-600">
                Invites will direct candidates to: <span className="font-medium text-slate-900">{selectedInternshipDestinationLabel || selectedInternshipDestination}</span>
              </p>
            ) : (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                ATS not configured for this listing.
              </p>
            )}
            <textarea
              value={inviteMessage}
              onChange={(event) => setInviteMessage(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="Optional note for student"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setInviteModalOpen(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !selectedInternshipDestination}
                onClick={() => {
                  void submitInvite()
                }}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirm invite
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {messageModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Message candidate</h3>
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              placeholder="Send context before ATS invite or follow-up instructions"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setMessageModalOpen(false)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void sendMessage()
                }}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Send message
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
