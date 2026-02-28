import Link from 'next/link'

type ChecklistItem = {
  label: string
  href: string
  done: boolean
}

type Props = {
  profileStrengthPercent: number
  checklistItems: ChecklistItem[]
  courseworkCourseCount: number
  courseworkCategoryCount: number
  nextBestActionLabel: string
  nextBestActionHref: string
}

export default function StudentProfileSetupPanel({
  profileStrengthPercent,
  checklistItems,
  courseworkCourseCount,
  courseworkCategoryCount,
  nextBestActionLabel,
  nextBestActionHref,
}: Props) {
  const missingCount = checklistItems.filter((item) => !item.done).length

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Profile checklist</p>
          <p className="mt-1 text-xs text-slate-600">
            {profileStrengthPercent}% complete • {missingCount === 0 ? 'Everything important is in place.' : `${missingCount} item${missingCount === 1 ? '' : 's'} still need attention.`}
          </p>
        </div>
        <Link href={nextBestActionHref} className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline">
          {nextBestActionLabel}
        </Link>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {checklistItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`rounded-lg border px-3 py-3 transition-colors ${
              item.done
                ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.done ? 'Done' : 'Needs attention'}</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{item.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-700">
        <p>
          Courses added: <span className="font-semibold text-slate-900">{courseworkCourseCount}</span>
        </p>
        <p>
          Coursework categories: <span className="font-semibold text-slate-900">{courseworkCategoryCount}</span>
        </p>
      </div>
    </section>
  )
}
