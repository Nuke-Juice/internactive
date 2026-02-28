import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import StudentResumeManager from '@/components/student/resume/StudentResumeManager'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { syncStudentResumeFromApplications } from '@/lib/student/profileResume'

export default async function StudentResumePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const { user } = await requireRole('student', { requestedPath: '/student/resume' })
  const supabase = await supabaseServer()
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const syncResult = await syncStudentResumeFromApplications({
    supabase,
    userId: user.id,
    currentMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/student/dashboard"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="mt-2">
          <h1 className="text-3xl font-semibold text-slate-900">Resume</h1>
          <p className="mt-2 text-sm text-slate-600">Manage the PDF used to apply faster across listings.</p>
        </div>

        <div className="mt-6">
          {resolvedSearchParams?.error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {resolvedSearchParams.error}
            </div>
          ) : null}
          <StudentResumeManager userId={user.id} initialResume={syncResult.profile} />
        </div>
      </section>
    </main>
  )
}
