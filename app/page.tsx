import Link from 'next/link'
import { Suspense } from 'react'
import JobsView, { JobsViewSkeleton, type JobsQuery } from '@/components/jobs/JobsView'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<JobsQuery>
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<JobsViewSkeleton />}>
        <JobsView searchParams={searchParams} basePath="/" anchorId="internships" />
      </Suspense>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Heard about internships?
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Start with the basics.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                An internship is short-term, real-world work experience while you are still in school or
                early in your career.
              </p>
              <p className="mt-2 text-base leading-relaxed text-slate-600">
                It helps you test a path, build practical skills, and make your next application stronger
                with experience employers can trust.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  <span>You get real examples to talk about in interviews.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  <span>You learn what day-to-day work in a role actually feels like.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  <span>You build momentum for better internships and full-time offers.</span>
                </li>
              </ul>

              <div className="mt-7">
                <Link
                  href="/#internships"
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Start here
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-100/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">How it works</h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold text-slate-500">Step 1</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">Students create a profile</div>
                <p className="mt-2 text-sm text-slate-600">
                  Major, coursework, experience level, and availability.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold text-slate-500">Step 2</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                  Internships are curated by readiness
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Students apply strategically instead of mass-applying.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold text-slate-500">Step 3</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">
                  Employers review fewer, better applicants
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Better signal, less spam, and faster decisions.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
            © {new Date().getFullYear()} Internactive - MVP preview
          </div>
        </footer>
    </main>
  )
}
