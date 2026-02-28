'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Briefcase, Star } from 'lucide-react'

type ApplicationStatusFilter = 'all' | 'submitted' | 'viewed' | 'interview' | 'accepted'

type PipelineSegment = {
  key: Exclude<ApplicationStatusFilter, 'all'>
  label: string
  count: number
  href: string
}

type DashboardApplicationRow = {
  id: string
  title: string
  company: string
  companyAvatarUrl: string | null
  companyInitials: string
  locationLabel: string
  status: Exclude<ApplicationStatusFilter, 'all'> | 'reviewing' | 'rejected' | 'withdrawn'
  statusLabel: string
  createdAtLabel: string
  href: string
}

type ChecklistItem = {
  label: string
  href: string
  done: boolean
}

type InsightItem = {
  label: string
  detail: string
  href: string
}

type NextAction = {
  title: string
  description: string
  href: string
  ctaLabel: string
}

type Props = {
  profileStrengthPercent: number
  pipelineSegments: PipelineSegment[]
  applications: DashboardApplicationRow[]
  nextAction: NextAction
  checklistItems: ChecklistItem[]
  topInsights: InsightItem[]
  stalledCount: number
}

function getStatusPill(status: DashboardApplicationRow['status']) {
  if (status === 'accepted') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'interview') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'viewed' || status === 'reviewing') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === 'rejected') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'withdrawn') return 'border-slate-200 bg-slate-100 text-slate-700'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function matchesFilter(row: DashboardApplicationRow, filter: ApplicationStatusFilter) {
  if (filter === 'all') return true
  if (filter === 'viewed') return row.status === 'viewed' || row.status === 'reviewing'
  return row.status === filter
}

function segmentClasses(active: boolean) {
  return active
    ? 'border-blue-200 bg-blue-50 text-blue-900'
    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
}

function filterHref(filter: ApplicationStatusFilter) {
  if (filter === 'all') return '/applications'
  return `/applications?status=${encodeURIComponent(filter)}`
}

export default function StudentDashboardExperience({
  profileStrengthPercent,
  pipelineSegments,
  applications,
  nextAction,
  checklistItems,
  topInsights,
  stalledCount,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<ApplicationStatusFilter>('all')

  const totalApplications = pipelineSegments.reduce((sum, item) => sum + item.count, 0)
  const filteredApplications = useMemo(
    () => applications.filter((row) => matchesFilter(row, activeFilter)),
    [activeFilter, applications]
  )
  const checklistComplete = checklistItems.every((item) => item.done)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.95fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Applications</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Pipeline</h2>
              <p className="mt-1 text-sm text-slate-600">
                Click a stage to focus the recent activity list without leaving the dashboard.
              </p>
            </div>
            <Link href={filterHref(activeFilter)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              Open applications
            </Link>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex h-3 w-full overflow-hidden">
              {pipelineSegments.map((segment, index) => {
                const width = totalApplications > 0 ? `${Math.max((segment.count / totalApplications) * 100, segment.count > 0 ? 10 : 0)}%` : `${100 / pipelineSegments.length}%`
                const colors = ['bg-slate-400', 'bg-amber-400', 'bg-blue-500', 'bg-emerald-500']
                return <div key={segment.key} className={colors[index] ?? 'bg-slate-400'} style={{ width }} />
              })}
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`rounded-xl border px-4 py-4 text-left transition-colors ${segmentClasses(activeFilter === 'all')}`}
              >
                <div className="text-xs uppercase tracking-wide text-current/70">All</div>
                <div className="mt-2 text-2xl font-semibold">{applications.length}</div>
                <div className="mt-1 text-sm text-current/80">Recent pipeline activity</div>
              </button>
              {pipelineSegments.map((segment) => (
                <button
                  key={segment.key}
                  type="button"
                  onClick={() => setActiveFilter(segment.key)}
                  className={`rounded-xl border px-4 py-4 text-left transition-colors ${segmentClasses(activeFilter === segment.key)}`}
                >
                  <div className="text-xs uppercase tracking-wide text-current/70">{segment.label}</div>
                  <div className="mt-2 text-2xl font-semibold">{segment.count}</div>
                  <div className="mt-1 text-sm text-current/80">{segment.key === 'viewed' ? 'Viewed or reviewing' : 'Open this stage'}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent applications</h3>
              <p className="mt-1 text-sm text-slate-600">
                {activeFilter === 'all' ? 'Latest activity across your pipeline.' : `Showing ${activeFilter === 'viewed' ? 'viewed/reviewing' : activeFilter} applications.`}
              </p>
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No applications in this stage.</p>
              <p className="mt-1 text-sm text-slate-600">Switch stages or browse fresh matches.</p>
              <Link href="/jobs" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:underline">
                Browse internships
              </Link>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {filteredApplications.map((application) => (
                <Link
                  key={application.id}
                  href={application.href}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                    {application.companyAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={application.companyAvatarUrl} alt={application.company} className="h-full w-full object-cover" />
                    ) : (
                      application.companyInitials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold text-slate-900">{application.title}</span>
                      <span className="text-sm text-slate-400">at</span>
                      <span className="truncate text-sm text-slate-700">{application.company}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{application.locationLabel}</span>
                      <span>{application.createdAtLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusPill(application.status)}`}>
                      {application.statusLabel}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Improve odds</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">What to strengthen next</h2>
            </div>
            <Star className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {topInsights.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next best action</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{nextAction.title}</h2>
            </div>
            <Briefcase className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{nextAction.description}</p>
          <Link
            href={nextAction.href}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            {nextAction.ctaLabel}
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{profileStrengthPercent}% complete</h2>
            </div>
            <Star className={`h-5 w-5 ${checklistComplete ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>

          {checklistComplete ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-900">Profile complete.</p>
              <p className="mt-1 text-sm text-slate-600">Resume, coursework, skills, availability, and location are all in place.</p>
              <Link href="/account" className="mt-3 inline-flex text-sm font-medium text-slate-900 hover:underline">
                Review profile
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {checklistItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    item.done
                      ? 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white'
                      : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${item.done ? 'text-slate-500' : 'text-blue-700'}`}>
                    {item.done ? 'Done' : 'Open'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
