import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import JobsView, { JobsViewSkeleton, type JobsQuery } from '@/components/jobs/JobsView'
import StudentPilotHub from '@/components/student/StudentPilotHub'
import { isUserRole } from '@/lib/auth/roles'
import { isPilotMode } from '@/lib/pilotMode'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ConciergeProfile = {
  concierge_opt_in?: boolean | null
  concierge_intake_completed_at?: string | null
  concierge_intake_answers?: unknown
}

function formatAppliedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Applied recently'
  return `Applied ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function ConciergeLanding() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div>
          <div>
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Concierge profile
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
              Create your profile and get curated internship intros.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Tell us what you want, what you can do, and when you&apos;re available. We use that profile to put you in front of better-fit employers.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup/student" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                Create concierge profile
              </Link>
              <Link
                href="/for-employers"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                For employers
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Profile-first matching</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Share major, schedule, skills, coursework, and goals before introductions start.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Founder-led concierge</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">We review submissions and make direct intros when there is a real fit.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Higher-signal applications</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">Employers see more context up front, which makes student profiles more useful.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<JobsQuery>
}) {
  const pilotMode = isPilotMode()
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach((cookie) => {
            cookieStore.set(cookie)
          })
        } catch {
          // cookies() can be read-only in some server contexts (e.g., RSC)
        }
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!pilotMode) {
    if (!user) {
      return <ConciergeLanding />
    }

    return (
      <main className="min-h-screen bg-slate-50">
        <Suspense fallback={<JobsViewSkeleton />}>
          <JobsView searchParams={searchParams} showHero basePath="/" anchorId="internships" />
        </Suspense>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <ConciergeLanding />
      </main>
    )
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle<{ role?: string | null }>()
  const metadataRole = user.app_metadata?.role ?? user.user_metadata?.role
  const resolvedRole = isUserRole(userRow?.role) ? userRow.role : isUserRole(metadataRole) ? metadataRole : null

  if (resolvedRole === 'student') {
    const [profileResult, applicationsResult] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('concierge_opt_in, concierge_intake_completed_at, concierge_intake_answers')
        .eq('user_id', user.id)
        .maybeSingle<ConciergeProfile>(),
      supabase
        .from('applications')
        .select('id, created_at, internship:internships(title, company_name)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    const profile = profileResult.data

    if (!profile) {
      await supabase.from('student_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' })
    }

    const recentApplications = (applicationsResult.data ?? []).map((application) => {
      const internship = Array.isArray(application.internship) ? application.internship[0] : application.internship
      return {
        id: application.id,
        title: internship?.title?.trim() || 'Internship',
        company: internship?.company_name?.trim() || 'Company',
        createdAtLabel: formatAppliedDate(application.created_at),
        href: `/applications?application=${encodeURIComponent(application.id)}#application-${encodeURIComponent(application.id)}`,
      }
    })

    return (
      <main className="min-h-screen bg-slate-50">
        <StudentPilotHub profile={profile ?? {}} recentApplications={recentApplications} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<JobsViewSkeleton />}>
        <JobsView searchParams={searchParams} showHero basePath="/" anchorId="internships" />
      </Suspense>
    </main>
  )
}
