import Link from 'next/link'
import { Briefcase, LogIn, Star, User } from 'lucide-react'

type PipelineMetric = {
  label: string
  count: number
  href: string
}

type Props = {
  profileStrengthPercent: number
  nextStep: string
  showCompleteProfileLink: boolean
  pipelineMetrics: PipelineMetric[]
  primaryCta: {
    label: string
    href: string
    helper: string
  }
}

export default function StudentDashboardSnapshot({
  profileStrengthPercent,
  nextStep,
  showCompleteProfileLink,
  pipelineMetrics,
  primaryCta,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1.8fr_1.15fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Profile strength</p>
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{profileStrengthPercent}%</p>
          <p className="mt-1 text-sm text-slate-700">Next: {nextStep}</p>
          {showCompleteProfileLink ? (
            <Link href="/account" className="mt-2 inline-flex text-xs font-medium text-slate-700 underline-offset-2 hover:underline">
              Complete profile
            </Link>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Applications pipeline</p>
            <Briefcase className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {pipelineMetrics.map((metric) => (
              <Link key={metric.label} href={metric.href} className="rounded-md border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
                <p className="text-lg font-semibold text-slate-900">{metric.count}</p>
                <p className="text-xs text-slate-600">{metric.label}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Next best action</p>
            <Star className="h-4 w-4 text-blue-600" />
          </div>
          <Link
            href={primaryCta.href}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {primaryCta.label}
            <LogIn className="h-4 w-4" />
          </Link>
          <p className="mt-2 text-xs text-slate-600">{primaryCta.helper}</p>
        </div>
      </div>
    </section>
  )
}
