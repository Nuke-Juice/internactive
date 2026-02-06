export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Apply less. Apply better.
        </h1>

        <p className="mt-4 text-lg text-slate-600">
          InternUP curates internships by major, experience, and timing — so
          students apply strategically and employers get higher-quality
          applicants.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <a
            href="/signup/student"
            className="rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Join as a Student
          </a>
          <a
            href="/signup/employer"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Post an Internship
          </a>
        </div>

        <div className="mt-16 grid gap-8 text-left sm:grid-cols-3">
          <div>
            <h3 className="font-medium text-slate-900">
              Create a profile
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Students share their major, coursework, experience, and
              availability.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-slate-900">
              Apply strategically
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Internships are curated by readiness — match, stretch, or
              exploratory.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-slate-900">
              Review better applicants
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Employers see fewer applications with clearer signals.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
