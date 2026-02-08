import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Internactive
            </span>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Browse internships
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/signup/employer"
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Employers
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Internship platform focused on clarity + quality
          </p>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Apply less. Apply better.
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            Internactive curates internships by major, experience, and timing — so
            students apply strategically and employers get higher-quality
            applicants.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Browse internships
            </Link>
            <Link
              href="/signup/employer"
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:underline"
            >
              For employers
            </Link>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            No ranking. No gamification. Just clearer signals and better-fit
            applications.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            What you get (MVP)
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">
                Readiness labels
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Match / Stretch / Exploratory — guidance, not judgment.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">
                Fewer applications, better signal
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Employers see a smaller, higher-quality pool based on profile fit.
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">
                Optional verification (later)
              </div>
              <div className="mt-1 text-sm text-slate-600">
                One-time $5 “Verified Serious Applicant” badge + priority review.
              </div>
            </div>
          </div>
        </div>

        {/* 3-step */}
        <div className="mt-24">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">How it works</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold text-slate-500">Step 1</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">
                Students create a profile
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Major, coursework, experience level, and availability.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold text-slate-500">Step 2</div>
              <div className="mt-2 text-sm font-semibold text-slate-800">
                Internships are curated by readiness
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Students apply strategically instead of mass-applying.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
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

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-500">
          © {new Date().getFullYear()} Internactive — MVP preview
        </div>
      </footer>
    </main>
  )
}
