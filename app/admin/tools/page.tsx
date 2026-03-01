import Link from 'next/link'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { requireAnyRole } from '@/lib/auth/requireAnyRole'

export default async function AdminToolsPage() {
  await requireAnyRole(ADMIN_ROLES, { requestedPath: '/admin/tools' })

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <section className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Admin tools</h1>
          <p className="mt-1 text-sm text-slate-600">
            Secondary platform admin links that stay available during the pilot without taking over the main workflow.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/admin/listings-queue" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-base font-semibold text-slate-900">Queue</div>
            <p className="mt-1 text-sm text-slate-600">Moderate listings and review flagged records.</p>
          </Link>

          <Link href="/admin/matching/preview" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-base font-semibold text-slate-900">Analytics</div>
            <p className="mt-1 text-sm text-slate-600">Preview matching outputs and inspect report data.</p>
          </Link>

          <Link href="/admin/matching/report" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50">
            <div className="text-base font-semibold text-slate-900">Reports</div>
            <p className="mt-1 text-sm text-slate-600">Open the deeper matching report and coverage views.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
