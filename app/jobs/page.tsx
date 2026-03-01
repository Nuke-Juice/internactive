import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import JobsView, { JobsViewSkeleton, type JobsQuery } from '@/components/jobs/JobsView'
import { getStudentPilotStatus, isPilotMode } from '@/lib/pilotMode'
import { supabaseServer } from '@/lib/supabase/server'

async function PilotJobsCallout() {
  if (!isPilotMode()) return null

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Prefer curated intros? Join Concierge Pilot.</div>
              <div className="mt-1 text-blue-900/80">Browsing is optional during the pilot.</div>
            </div>
            <Link href="/signup/student" className="font-semibold text-blue-700 hover:text-blue-900">
              Join now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle<{ role?: string | null }>()
  if (userRow?.role !== 'student') return null

  const { data: profile } = await supabase
    .from('student_profiles')
    .select('concierge_opt_in, concierge_intake_completed_at')
    .eq('user_id', user.id)
    .maybeSingle<{ concierge_opt_in?: boolean | null; concierge_intake_completed_at?: string | null }>()

  const status = getStudentPilotStatus(profile)

  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">
              {status === 'inPool' ? "You're already in the concierge pool." : 'Prefer curated intros? Join Concierge Pilot.'}
            </div>
            <div className="mt-1 text-blue-900/80">Browsing is optional during the pilot. Direct apply still works.</div>
          </div>
          <Link href="/student/pilot-screening" className="font-semibold text-blue-700 hover:text-blue-900">
            {status === 'inPool' ? 'Update preferences' : 'Join concierge pilot'}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<JobsQuery>
}) {
  if (isPilotMode()) {
    const supabase = await supabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle<{ role?: string | null }>()
      if (userRow?.role === 'student') {
        redirect('/?from=jobs_disabled')
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <PilotJobsCallout />
      <Suspense fallback={<JobsViewSkeleton />}>
        <JobsView searchParams={searchParams} showHero basePath="/jobs" anchorId="internships" />
      </Suspense>
    </main>
  )
}
