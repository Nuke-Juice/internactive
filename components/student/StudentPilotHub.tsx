import Link from 'next/link'
import { getStudentPilotStatus } from '@/lib/pilotMode'

type StudentPilotProfile = {
  concierge_opt_in?: boolean | null
  concierge_intake_completed_at?: string | null
  concierge_intake_answers?: unknown
}

type RecentApplication = {
  id: string
  title: string
  company: string
  createdAtLabel: string
  href: string
}

type Props = {
  profile?: StudentPilotProfile | null
  recentApplications?: RecentApplication[]
  resumeHref?: string
}

function formatLastUpdated(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StudentPilotHub({ profile, recentApplications = [], resumeHref = '/student/resume' }: Props) {
  const status = getStudentPilotStatus(profile)
  const inPool = status === 'inPool'
  const lastUpdated = formatLastUpdated(profile?.concierge_intake_completed_at)

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-12">
          <div className="max-w-2xl">
            <div className={`text-xs font-semibold uppercase tracking-[0.2em] ${inPool ? 'text-emerald-700' : 'text-blue-700'}`}>
              Pilot Hub
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
              {inPool ? "You're in the Concierge Pool ✅" : 'Get Curated Internship Intros'}
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {inPool
                ? "We'll introduce you to 1-3 employers as roles open."
                : 'Submit your preferences once. We review every intake and introduce top candidates directly.'}
            </p>
            <div className={`mt-6 rounded-2xl border px-4 py-4 text-sm ${inPool ? 'border-emerald-100 bg-emerald-50 text-emerald-900' : 'border-blue-100 bg-blue-50 text-blue-950'}`}>
              {inPool ? (
                <div className="space-y-2">
                  {lastUpdated ? <div>Last updated {lastUpdated}</div> : null}
                  <div>What happens next:</div>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>We review your preferences against new employer demand.</li>
                    <li>When there is a match, you&apos;ll see the introduction here first.</li>
                    <li>Keep your resume and preferences current so we can move quickly.</li>
                  </ul>
                </div>
              ) : (
                'Tell us your timing, role targets, and short pitch so we can place you in the pool.'
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/student/pilot-screening"
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {inPool ? 'Update preferences' : 'Join Concierge Pilot'}
              </Link>
              {inPool ? (
                <Link href={resumeHref} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Upload or update resume
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {inPool ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your introductions</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">No introductions yet. When we match you, you&apos;ll see it here.</p>
          </div>
        ) : null}

        {inPool ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your direct applications (optional)</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Direct apply tracking stays here for reference, but concierge is the primary path during the pilot.
            </p>
            {recentApplications.length > 0 ? (
              <div className="mt-4 space-y-3">
                {recentApplications.map((application) => (
                  <Link
                    key={application.id}
                    href={application.href}
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
                  >
                    <div className="text-sm font-medium text-slate-900">{application.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{application.company}</div>
                    <div className="mt-1 text-xs text-slate-500">{application.createdAtLabel}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No direct applications yet.</p>
            )}
          </div>
        ) : null}

        {inPool ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Questions? Reply to the welcome email or message support.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
