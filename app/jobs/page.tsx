import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { calculateMatchScore, parseMajors } from '@/lib/jobs/matching'
import FiltersPanel from './_components/FiltersPanel'
import JobCard from './_components/JobCard'

type Internship = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  experience_level: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  pay: string | null
  created_at: string | null
}

const categoryTiles = [
  'Finance',
  'Accounting',
  'Data',
  'Marketing',
  'Operations',
  'Product',
  'Design',
  'Sales',
  'HR',
  'Engineering',
]

function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

type Query = {
  category?: string
  paid?: string
  type?: string
  remote?: string
  exp?: string
  hours?: string
}

type MatchContext = {
  profileMajors: string[]
  profileAvailability: number | null
  profileCoursework: string[]
}

function getType(hoursPerWeek: number | null) {
  return typeof hoursPerWeek === 'number' && hoursPerWeek <= 20 ? 'part-time' : 'internship'
}

function getMatchSignals(listing: Internship, context: MatchContext) {
  const signals: string[] = []
  const listingMajors = parseMajors(listing.majors)
  const majorHit = listingMajors.find((major) => context.profileMajors.includes(major))

  if (majorHit) {
    signals.push(`Major fit (${majorHit})`)
  }

  if (
    typeof listing.hours_per_week === 'number' &&
    typeof context.profileAvailability === 'number' &&
    Math.abs(listing.hours_per_week - context.profileAvailability) <= 5
  ) {
    signals.push('Availability aligns')
  }

  if (context.profileCoursework.length > 0) {
    const title = listing.title?.toLowerCase() ?? ''
    const courseworkHit = context.profileCoursework.find((course) => {
      const token = course.toLowerCase().split(' ').find((value) => value.length > 2) ?? ''
      return token.length > 2 && title.includes(token)
    })

    if (courseworkHit) {
      signals.push(`Coursework (${courseworkHit})`)
    }
  }

  return signals.slice(0, 2)
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<Query>
}) {
  const resolvedSearchParams = (searchParams ? await searchParams : {}) as Query
  const activeCategory = resolvedSearchParams.category ?? ''
  const paidOnly = resolvedSearchParams.paid === '1'
  const selectedType =
    resolvedSearchParams.type === 'internship' || resolvedSearchParams.type === 'part-time'
      ? resolvedSearchParams.type
      : ''
  const remoteOnly = resolvedSearchParams.remote === '1'
  const selectedExperience = resolvedSearchParams.exp ?? ''
  const maxHours = resolvedSearchParams.hours ?? ''

  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: internships } = await supabase
    .from('internships')
    .select('id, title, company_name, location, experience_level, majors, hours_per_week, pay, created_at')
    .order('created_at', { ascending: false })

  let sortedInternships = internships ?? []
  let isBestMatch = false
  let profileMajors: string[] = []
  let profileAvailability: number | null = null
  let profileCoursework: string[] = []

  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('majors, availability_hours_per_week, coursework')
      .eq('user_id', user.id)
      .maybeSingle()

    profileMajors = parseMajors(profile?.majors ?? null)
    profileAvailability = profile?.availability_hours_per_week ?? null
    profileCoursework = Array.isArray(profile?.coursework)
      ? profile.coursework.filter(
          (course): course is string => typeof course === 'string' && course.length > 0
        )
      : []

    if (profileMajors.length > 0 || typeof profileAvailability === 'number') {
      isBestMatch = true
      sortedInternships = [...sortedInternships]
        .map((listing) => ({
          ...listing,
          matchScore: calculateMatchScore(
            {
              majors: listing.majors,
              hoursPerWeek: listing.hours_per_week,
              createdAt: listing.created_at,
            },
            {
              majors: profileMajors,
              availabilityHoursPerWeek: profileAvailability,
            }
          ),
        }))
        .sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })
    }
  }

  const filteredInternships = sortedInternships.filter((listing) => {
    const listingMajors = parseMajors(listing.majors)
    const normalizedTitle = listing.title?.toLowerCase() ?? ''
    const isRemote = (listing.location ?? '').toLowerCase().includes('remote')
    const listingType = getType(listing.hours_per_week)
    const listingExperience = (listing.experience_level ?? '').toLowerCase()
    const isPaid = Boolean(listing.pay && listing.pay.trim() && listing.pay.toLowerCase() !== 'tbd')
    const parsedMaxHours = maxHours ? Number(maxHours) : null

    if (activeCategory) {
      const normalizedCategory = activeCategory.toLowerCase()
      const hasCategoryMatch =
        listingMajors.some((major) => major.includes(normalizedCategory)) ||
        normalizedTitle.includes(normalizedCategory)
      if (!hasCategoryMatch) return false
    }

    if (paidOnly && !isPaid) return false
    if (selectedType && listingType !== selectedType) return false
    if (remoteOnly && !isRemote) return false
    if (selectedExperience && listingExperience !== selectedExperience) return false
    if (typeof parsedMaxHours === 'number' && typeof listing.hours_per_week === 'number') {
      if (listing.hours_per_week > parsedMaxHours) return false
    }

    return true
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
            <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              Internactive
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/signup/student"
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Find your next internship</h1>
            <p className="mt-1 text-sm text-slate-600">
              Quick filters up front, deeper refinements on demand.
            </p>
          </div>
          <div className="text-right text-xs font-medium text-slate-500">
            <div>Sort: {isBestMatch ? 'Best match' : 'Newest'}</div>
            <div className="mt-1">{filteredInternships.length} results</div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <FiltersPanel
            categories={categoryTiles}
            state={{
              category: activeCategory,
              paidOnly,
              jobType: selectedType,
              remoteOnly,
              experience: selectedExperience,
              maxHours,
            }}
          />

          <div className="space-y-4">
            {filteredInternships.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">You are early, and that is a good thing.</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    We are still expanding listings in this early-access phase. Check back soon or reset filters to
                    browse everything currently available.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/jobs"
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      View all internships
                    </Link>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[0, 1].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-2/3 rounded bg-slate-200" />
                        <div className="h-3 w-1/3 rounded bg-slate-200" />
                        <div className="mt-2 flex gap-2">
                          <div className="h-6 w-24 rounded-full bg-slate-200" />
                          <div className="h-6 w-20 rounded-full bg-slate-200" />
                        </div>
                        <div className="h-3 w-5/6 rounded bg-slate-200" />
                        <div className="h-9 w-32 rounded bg-slate-200" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              filteredInternships.map((listing) => {
                const matchSignals = user
                  ? getMatchSignals(listing, {
                      profileMajors,
                      profileAvailability,
                      profileCoursework,
                    })
                  : []

                return (
                  <JobCard
                    key={listing.id}
                    listing={{
                      ...listing,
                      majorsText: formatMajors(listing.majors),
                      jobType: getType(listing.hours_per_week),
                    }}
                    isAuthenticated={Boolean(user)}
                    matchSignals={matchSignals}
                  />
                )
              })
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
