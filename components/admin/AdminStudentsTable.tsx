'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useMemo, useState } from 'react'
import { useToast } from '@/components/feedback/ToastProvider'

type StudentViewRow = {
  user_id: string
  name: string
  email: string
  major_label: string
  school: string | null
  year: string | null
  experience_level: string | null
  availability_label: string
  canonical_skill_labels: string[]
  coursework_category_names: string[]
  coursework_category_status: 'present' | 'inference_pending' | 'none'
  missing_match_dimensions: string[]
  coverage_label: string
}

type StudentDetailResponse = {
  profile: {
    name: string | null
    email: string | null
    school: string | null
    majors: string[]
    year: string | null
    availabilityStartMonth: string | null
    availabilityHoursPerWeek: number | null
    experienceLevel: string | null
    resumePresent: boolean
    profileCompletenessPercent: number
    missingProfileFields: string[]
    canonicalSkillsCount: number
    courseworkCategoriesCount: number
  }
  usage: {
    accountCreatedAt: string | null
    lastActiveAt: string | null
    lastSeenAt: string | null
    internshipViewsCount: number
    applicationsSubmittedCount: number
    trackedEventsCount: number
    savedInternshipsCount: number | null
    profileUpdatesCount: number | null
  }
  quickActions: {
    previewMatchesHref: string
    viewFullProfileHref: string | null
  }
}

type StudentTopMatchResponse = {
  student: {
    id: string
    name: string
    email: string
  }
  matches: Array<{
    internshipId: string
    title: string
    companyName: string
    score: number
    reasons: string[]
  }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'n/a'
  return parsed.toLocaleString()
}

export default function AdminStudentsTable({
  rows,
  q,
  deleteStudentAccountAction,
}: {
  rows: StudentViewRow[]
  q: string
  deleteStudentAccountAction: (formData: FormData) => void
}) {
  const router = useRouter()
  const { showToast } = useToast()
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({})
  const [detailsById, setDetailsById] = useState<Record<string, StudentDetailResponse | null>>({})
  const [errorById, setErrorById] = useState<Record<string, string | null>>({})
  const [shortlistOpenId, setShortlistOpenId] = useState<string | null>(null)
  const [shortlistLoadingIds, setShortlistLoadingIds] = useState<Record<string, boolean>>({})
  const [shortlistSubmittingIds, setShortlistSubmittingIds] = useState<Record<string, string | null>>({})
  const [topMatchesById, setTopMatchesById] = useState<Record<string, StudentTopMatchResponse | null>>({})
  const [shortlistErrorById, setShortlistErrorById] = useState<Record<string, string | null>>({})
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const visibleRows = useMemo(() => rows, [rows])

  async function toggleExpanded(studentId: string) {
    const isExpanded = Boolean(expandedIds[studentId])
    if (isExpanded) {
      setExpandedIds((prev) => ({ ...prev, [studentId]: false }))
      return
    }
    setExpandedIds((prev) => ({ ...prev, [studentId]: true }))
    if (detailsById[studentId] !== undefined) return

    setLoadingIds((prev) => ({ ...prev, [studentId]: true }))
    setErrorById((prev) => ({ ...prev, [studentId]: null }))
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/details`, { cache: 'no-store' })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Could not load student details.')
      }
      const payload = (await response.json()) as StudentDetailResponse
      setDetailsById((prev) => ({ ...prev, [studentId]: payload }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load student details.'
      setErrorById((prev) => ({ ...prev, [studentId]: message }))
      setDetailsById((prev) => ({ ...prev, [studentId]: null }))
    } finally {
      setLoadingIds((prev) => ({ ...prev, [studentId]: false }))
    }
  }

  async function openShortlist(studentId: string) {
    setShortlistOpenId(studentId)
    if (topMatchesById[studentId] !== undefined) return

    setShortlistLoadingIds((prev) => ({ ...prev, [studentId]: true }))
    setShortlistErrorById((prev) => ({ ...prev, [studentId]: null }))
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/top-matches`, { cache: 'no-store' })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Could not load top matches.')
      }
      const payload = (await response.json()) as StudentTopMatchResponse
      setTopMatchesById((prev) => ({ ...prev, [studentId]: payload }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load top matches.'
      setShortlistErrorById((prev) => ({ ...prev, [studentId]: message }))
      setTopMatchesById((prev) => ({ ...prev, [studentId]: null }))
    } finally {
      setShortlistLoadingIds((prev) => ({ ...prev, [studentId]: false }))
    }
  }

  async function shortlistStudent(studentId: string, internshipId: string) {
    setShortlistSubmittingIds((prev) => ({ ...prev, [studentId]: internshipId }))
    setShortlistErrorById((prev) => ({ ...prev, [studentId]: null }))
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentId)}/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internshipId }),
      })
      const body = (await response.json().catch(() => null)) as { error?: string; href?: string } | null
      if (!response.ok || !body?.href) {
        throw new Error(body?.error || 'Could not add student to shortlist.')
      }
      showToast({ kind: 'success', message: 'Added to shortlist.' })
      setShortlistOpenId(null)
      router.push(body.href)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add student to shortlist.'
      setShortlistErrorById((prev) => ({ ...prev, [studentId]: message }))
    } finally {
      setShortlistSubmittingIds((prev) => ({ ...prev, [studentId]: null }))
    }
  }

  async function copyEmail(email: string) {
    await navigator.clipboard.writeText(email)
    showToast({ kind: 'success', message: 'Email copied.' })
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Major</th>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Experience level</th>
              <th className="px-3 py-2">Availability</th>
              <th className="px-3 py-2">Canonical selections</th>
              <th className="px-3 py-2">Match coverage</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                  No student profiles found.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const isExpanded = Boolean(expandedIds[row.user_id])
                const isLoading = Boolean(loadingIds[row.user_id])
                const details = detailsById[row.user_id]
                const detailError = errorById[row.user_id]
                return (
                  <Fragment key={row.user_id}>
                    <tr>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                        <div className="font-mono text-[11px] text-slate-500">{row.user_id}</div>
                        <button
                          type="button"
                          onClick={() => {
                            void toggleExpanded(row.user_id)
                          }}
                          className="mt-2 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          {isExpanded ? 'Hide info' : 'Info'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.major_label}</td>
                      <td className="px-3 py-2 text-slate-700">{row.school ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.year ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.experience_level ?? 'n/a'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.availability_label}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div>Skills: {row.canonical_skill_labels.slice(0, 3).join(', ') || 'none'}</div>
                        <div>
                          Coursework categories:{' '}
                          {row.coursework_category_names.slice(0, 2).join(', ') ||
                            (row.coursework_category_status === 'inference_pending' ? 'inference pending' : 'none')}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        <div
                          className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${
                            row.missing_match_dimensions.length === 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-amber-300 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.coverage_label}
                        </div>
                        <div className="mt-1 text-slate-600">
                          Missing: {row.missing_match_dimensions.join(', ') || 'none'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void openShortlist(row.user_id)
                            }}
                            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            Shortlist
                          </button>
                          <Link
                            href={`/admin/matching/preview?student=${encodeURIComponent(row.user_id)}`}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Matches
                          </Link>
                          <div className="relative">
                            <button
                              type="button"
                              aria-label="More actions"
                              aria-expanded={menuOpenId === row.user_id}
                              onClick={() => {
                                setMenuOpenId((current) => (current === row.user_id ? null : row.user_id))
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <span aria-hidden="true">⋯</span>
                            </button>
                            {menuOpenId === row.user_id ? (
                              <div className="absolute right-0 top-10 z-10 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                                <Link
                                  href={`/admin/candidates/${encodeURIComponent(row.user_id)}`}
                                  className="block px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  onClick={() => setMenuOpenId(null)}
                                >
                                  Open dossier
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void copyEmail(row.email)
                                    setMenuOpenId(null)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Copy email
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null)
                                    void toggleExpanded(row.user_id)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  {isExpanded ? 'Hide details' : 'More'}
                                </button>
                                <div className="my-1 border-t border-slate-200" />
                                <form
                                  action={deleteStudentAccountAction}
                                  onSubmit={(event) => {
                                    if (!window.confirm(`Delete account for ${row.name}? This cannot be undone.`)) {
                                      event.preventDefault()
                                    } else {
                                      setMenuOpenId(null)
                                    }
                                  }}
                                >
                                  <input type="hidden" name="student_id" value={row.user_id} />
                                  <input type="hidden" name="q" value={q} />
                                  <button
                                    type="submit"
                                    className="block w-full px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"
                                  >
                                    Delete account
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={9} className="bg-slate-50 px-3 py-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            {isLoading ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                                  <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                                </div>
                                <div className="space-y-2">
                                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                                  <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                                </div>
                              </div>
                            ) : detailError ? (
                              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {detailError}
                              </div>
                            ) : details ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2 text-xs text-slate-700">
                                  <p className="text-sm font-semibold text-slate-900">Profile details</p>
                                  <p>Name: {details.profile.name || row.name}</p>
                                  <p>Email: {details.profile.email || row.email}</p>
                                  <p>School: {details.profile.school || row.school || 'n/a'}</p>
                                  <p>Majors: {details.profile.majors.join(', ') || row.major_label}</p>
                                  <p>Year: {details.profile.year || row.year || 'n/a'}</p>
                                  <p>
                                    Availability: {details.profile.availabilityStartMonth || row.availability_label.split(' · ')[0] || 'n/a'} /{' '}
                                    {details.profile.availabilityHoursPerWeek
                                      ? `${details.profile.availabilityHoursPerWeek}h/wk`
                                      : row.availability_label.split(' · ')[1] || 'n/a'}
                                  </p>
                                  <p>Experience level: {details.profile.experienceLevel || row.experience_level || 'n/a'}</p>
                                  <p>Resume present: {details.profile.resumePresent ? 'Yes' : 'No'}</p>
                                  <p>Minimum profile completeness: {details.profile.profileCompletenessPercent}%</p>
                                  <p>
                                    Missing minimum fields:{' '}
                                    {details.profile.missingProfileFields.length > 0 ? details.profile.missingProfileFields.join(', ') : 'none'}
                                  </p>
                                  <p>Canonical skills: {details.profile.canonicalSkillsCount}</p>
                                  <p>Coursework categories: {details.profile.courseworkCategoriesCount}</p>
                                </div>
                                <div className="space-y-2 text-xs text-slate-700">
                                  <p className="text-sm font-semibold text-slate-900">Usage stats</p>
                                  <p>Account created: {formatDate(details.usage.accountCreatedAt)}</p>
                                  <p>Last active: {formatDate(details.usage.lastActiveAt)}</p>
                                  <p>Last seen: {formatDate(details.usage.lastSeenAt)}</p>
                                  <p>Tracked events: {details.usage.trackedEventsCount}</p>
                                  <p>Internship views: {details.usage.internshipViewsCount}</p>
                                  <p>Applications submitted: {details.usage.applicationsSubmittedCount}</p>
                                  <p>
                                    Saved internships:{' '}
                                    {details.usage.savedInternshipsCount === null ? 'Usage stats not available yet' : details.usage.savedInternshipsCount}
                                  </p>
                                  <p>
                                    Profile updates:{' '}
                                    {details.usage.profileUpdatesCount === null ? 'Usage stats not available yet' : details.usage.profileUpdatesCount}
                                  </p>
                                  <div className="pt-2">
                                    <div className="flex flex-wrap gap-2">
                                      <Link
                                        href={details.quickActions.previewMatchesHref}
                                        className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                      >
                                        Preview matches
                                      </Link>
                                      <Link
                                        href={`/admin/candidates/${encodeURIComponent(row.user_id)}`}
                                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                      >
                                        Open dossier
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500">No details available.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {shortlistOpenId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Shortlist to internship</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Use the existing match preview ranking to add this student directly to a candidate pack.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShortlistOpenId(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {shortlistLoadingIds[shortlistOpenId] ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : shortlistErrorById[shortlistOpenId] ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {shortlistErrorById[shortlistOpenId]}
              </div>
            ) : topMatchesById[shortlistOpenId]?.matches?.length ? (
              <div className="mt-4 space-y-3">
                {topMatchesById[shortlistOpenId]!.matches.map((match) => {
                  const submitting = shortlistSubmittingIds[shortlistOpenId] === match.internshipId
                  return (
                    <div key={match.internshipId} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{match.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{match.companyName}</div>
                          <div className="mt-2 text-xs text-emerald-800">{match.reasons.join(' • ') || 'No highlighted reasons'}</div>
                        </div>
                        <div className="text-right">
                          <div className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                            {match.score.toFixed(1)}
                          </div>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              void shortlistStudent(shortlistOpenId, match.internshipId)
                            }}
                            className="mt-3 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {submitting ? 'Adding...' : 'Add to shortlist'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                No top matches available for this student.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
