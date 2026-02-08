import Link from 'next/link'

export default function UpgradePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Upgrade to Verified</h1>
          <p className="mt-2 text-slate-600">
            Verified accounts get higher visibility and expanded access. This page no longer uses demo listings.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Free</div>
              <p className="mt-1 text-sm text-slate-600">Core profile + standard browsing experience.</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-semibold text-blue-900">Verified</div>
              <p className="mt-1 text-sm text-blue-800">Expanded access and stronger trust signals.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/jobs"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to jobs
            </Link>
            <Link
              href="/account"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Manage account
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
