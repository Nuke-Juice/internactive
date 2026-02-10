import Link from 'next/link'

export default function RequestEmployerClaimLinkPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Request a new claim link</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your previous link may be expired, used, or tied to a different email.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Contact your concierge/admin and ask them to resend an employer claim link to your contact email.
        </p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  )
}
