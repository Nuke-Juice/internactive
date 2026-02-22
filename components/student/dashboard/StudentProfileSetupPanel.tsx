import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

type Props = {
  profileStrengthPercent: number
  missingLabels: string[]
  completedChecklist: string[]
  missingChecklist: string[]
  courseworkCourseCount: number
  courseworkCategoryCount: number
  nextBestAction: string
}

export default function StudentProfileSetupPanel({
  profileStrengthPercent,
  missingLabels,
  completedChecklist,
  missingChecklist,
  courseworkCourseCount,
  courseworkCategoryCount,
  nextBestAction,
}: Props) {
  const missingSummary = missingLabels.length > 0 ? missingLabels.slice(0, 2).join(', ') : 'Nothing missing'

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Profile setup: {profileStrengthPercent}%</p>
            <p className="mt-1 text-xs text-slate-600">Missing: {missingSummary}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
            Details
            <ChevronDown className="h-4 w-4" />
          </span>
        </summary>

        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Complete</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {completedChecklist.length > 0 ? completedChecklist.map((item) => <li key={item}>• {item}</li>) : <li>• Nothing complete yet</li>}
              </ul>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {missingChecklist.length > 0 ? missingChecklist.map((item) => <li key={item}>• {item}</li>) : <li>• No missing items</li>}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
            <p>
              Courses added: <span className="font-semibold text-slate-900">{courseworkCourseCount}</span>
            </p>
            <p>
              Coursework categories: <span className="font-semibold text-slate-900">{courseworkCategoryCount}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-700">Next best action: {nextBestAction}</p>
            <Link href="/account" className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline">
              Edit profile
            </Link>
          </div>
        </div>
      </details>
    </section>
  )
}
