import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'

export default async function EmployerAnalyticsPage() {
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/analytics' })
  const supabase = await supabaseServer()

  const [{ count: totalInternships }, { count: activeInternships }, { data: internshipRows }] = await Promise.all([
    supabase.from('internships').select('id', { count: 'exact', head: true }).eq('employer_id', user.id),
    supabase.from('internships').select('id', { count: 'exact', head: true }).eq('employer_id', user.id).eq('is_active', true),
    supabase.from('internships').select('id').eq('employer_id', user.id),
  ])
  const internshipIds = (internshipRows ?? []).map((row) => row.id)
  const { count: totalApplications } =
    internshipIds.length > 0
      ? await supabase.from('applications').select('id', { count: 'exact', head: true }).in('internship_id', internshipIds)
      : { count: 0 }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-3">
          <Link
            href="/dashboard/employer"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-1 text-slate-600">Quick view of internship and applicant activity.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total listings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totalInternships ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active listings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{activeInternships ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total applicants</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totalApplications ?? 0}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard/employer/new"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create new internship
          </Link>
          <Link
            href="/dashboard/employer/applicants"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View applicants
          </Link>
        </div>
      </section>
    </main>
  )
}
