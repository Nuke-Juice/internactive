import Link from 'next/link'

type ApplicationPreviewRow = {
  id: string
  title: string
  company: string
  status: string
  createdAt: string
  href: string
}

type Props = {
  applications: ApplicationPreviewRow[]
}

function formatAppliedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getStatusPill(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'accepted') return { label: 'Accepted', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  if (normalized === 'interview') return { label: 'Interview', className: 'bg-blue-50 text-blue-700 border-blue-200' }
  if (normalized === 'reviewing') return { label: 'Reviewing', className: 'bg-amber-50 text-amber-700 border-amber-200' }
  if (normalized === 'rejected') return { label: 'Rejected', className: 'bg-rose-50 text-rose-700 border-rose-200' }
  if (normalized === 'withdrawn') return { label: 'Withdrawn', className: 'bg-slate-100 text-slate-700 border-slate-200' }
  if (normalized === 'viewed') return { label: 'Viewed', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  return { label: 'Submitted', className: 'bg-slate-100 text-slate-700 border-slate-200' }
}

export default function StudentDashboardPipelinePreview({ applications }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Recent Applications</h2>
        <Link href="/applications" className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline">
          View all
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm text-slate-700">No applications yet.</p>
          <Link href="/jobs" className="mt-2 inline-flex text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
            Browse internships
          </Link>
        </div>
      ) : (
        <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
          {applications.map((application) => {
            const pill = getStatusPill(application.status)
            return (
              <Link
                key={application.id}
                href={application.href}
                className="flex flex-col gap-2 px-3 py-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{application.title}</p>
                  <p className="truncate text-xs text-slate-600">{application.company}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${pill.className}`}>{pill.label}</span>
                  <span className="text-xs text-slate-500">Applied {formatAppliedDate(application.createdAt)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
