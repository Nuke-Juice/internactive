'use client'

import { Star } from 'lucide-react'
import { useMemo, useState } from 'react'

type Applicant = {
  id: string
  applicationId: string
  studentId: string
  applicantName: string
  university: string
  major: string
  graduationYear: string
  fitSummary: string
  appliedAt: string | null
  matchScore: number | null
  topReasons: string[]
  readinessLabel?: string | null
  resumeUrl: string | null
  openApplicationHref: string
  employerViewedAt: string | null
  status: 'submitted' | 'reviewing' | 'interview' | 'rejected' | 'accepted'
  notes: string | null
}

type Props = {
  employerUserId: string
  internshipId: string
  internshipTitle: string
  applicantCountText: string
  responseRateText: string
  applicants: Applicant[]
  onUpdate: (formData: FormData) => Promise<void>
  showMatchScore: boolean
  showReasons: boolean
  showReadiness: boolean
}

function readBookmarks(storageKey: string) {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set<string>()
    const ids = parsed.filter((value): value is string => typeof value === 'string')
    return new Set(ids)
  } catch {
    return new Set<string>()
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not viewed yet'
  try {
    return `Viewed ${new Date(value).toLocaleString()}`
  } catch {
    return `Viewed ${value}`
  }
}

function statusClass(status: Applicant['status']) {
  const map: Record<Applicant['status'], string> = {
    submitted: 'border-slate-200 bg-slate-50 text-slate-700',
    reviewing: 'border-blue-200 bg-blue-50 text-blue-700',
    interview: 'border-blue-200 bg-blue-50 text-blue-700',
    rejected: 'border-slate-200 bg-slate-100 text-slate-700',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }
  return map[status]
}

export default function ApplicantsInboxGroup({
  employerUserId,
  internshipId,
  internshipTitle,
  applicantCountText,
  responseRateText,
  applicants,
  onUpdate,
  showMatchScore,
  showReasons,
  showReadiness,
}: Props) {
  const bookmarkStorageKey = useMemo(
    () => `employer_bookmarks:${employerUserId}:${internshipId}`,
    [employerUserId, internshipId]
  )
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => readBookmarks(bookmarkStorageKey))

  function toggleBookmark(applicationId: string) {
    const next = new Set(bookmarkedIds)
    if (next.has(applicationId)) {
      next.delete(applicationId)
    } else {
      next.add(applicationId)
    }
    window.localStorage.setItem(bookmarkStorageKey, JSON.stringify(Array.from(next)))
    setBookmarkedIds(next)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{internshipTitle || 'Internship'}</div>
        <div className="mt-1 text-xs text-slate-500">{applicantCountText}</div>
        <div className="mt-1 text-xs text-slate-500">{responseRateText}</div>
        <div className="mt-1 text-xs text-slate-500">Viewing applications quickly improves trust and your response rate.</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Applicant</th>
              <th className="px-4 py-3 font-medium">Applied</th>
              <th className="px-4 py-3 font-medium">University</th>
              <th className="px-4 py-3 font-medium">Major</th>
              <th className="px-4 py-3 font-medium">Class</th>
              {showMatchScore ? <th className="px-4 py-3 font-medium">Match</th> : null}
              {showReasons ? <th className="px-4 py-3 font-medium">Why this matches</th> : null}
              {showReadiness ? <th className="px-4 py-3 font-medium">Readiness</th> : null}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant) => (
              <tr key={applicant.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900">{applicant.applicantName}</div>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(applicant.applicationId)}
                      aria-label={bookmarkedIds.has(applicant.applicationId) ? 'Remove bookmark' : 'Bookmark applicant'}
                      title={bookmarkedIds.has(applicant.applicationId) ? 'Bookmarked' : 'Bookmark'}
                      className={`rounded-md p-1 ${
                        bookmarkedIds.has(applicant.applicationId)
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${bookmarkedIds.has(applicant.applicationId) ? 'fill-current' : ''}`}
                      />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(applicant.appliedAt)}</td>
                <td className="px-4 py-3 text-slate-700">{applicant.university}</td>
                <td className="px-4 py-3 text-slate-700">{applicant.major}</td>
                <td className="px-4 py-3 text-slate-700">{applicant.graduationYear}</td>
                {showMatchScore ? (
                  <td className="px-4 py-3 text-slate-900">
                    {typeof applicant.matchScore === 'number' ? applicant.matchScore : '—'}
                  </td>
                ) : null}
                {showReasons ? (
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {applicant.topReasons.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {applicant.topReasons.map((reason) => (
                          <li key={`${applicant.id}-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
                {showReadiness ? (
                  <td className="px-4 py-3 text-xs text-slate-700">{applicant.readinessLabel ?? 'Baseline'}</td>
                ) : null}
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(applicant.status)}`}>
                    {applicant.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <details className="w-full max-w-[320px]">
                    <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Review & actions
                    </summary>
                    <form action={onUpdate} className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <a
                        href={applicant.openApplicationHref}
                        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        Review applicant
                      </a>
                      {!applicant.resumeUrl ? <div className="text-xs text-slate-500">No resume on file</div> : null}
                      <div className="text-[11px] text-slate-500">{formatDateTime(applicant.employerViewedAt)}</div>
                      <input type="hidden" name="application_id" value={applicant.applicationId} />
                      <input type="hidden" name="internship_id" value={internshipId} />
                      <select
                        name="status"
                        defaultValue={applicant.status}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      >
                        <option value="submitted">submitted</option>
                        <option value="reviewing">reviewing</option>
                        <option value="interview">interview</option>
                        <option value="rejected">rejected</option>
                        <option value="accepted">accepted</option>
                      </select>
                      <textarea
                        name="notes"
                        defaultValue={applicant.notes ?? ''}
                        rows={2}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400"
                        placeholder="Add note (optional)"
                      />
                      <button
                        type="submit"
                        className="inline-flex rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Save
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
