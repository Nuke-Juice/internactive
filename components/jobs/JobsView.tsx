import Link from 'next/link'
import { calculateMatchScore, parseMajors } from '@/lib/jobs/matching'
import { fetchInternships, formatMajors, getInternshipType, type Internship } from '@/lib/jobs/internships'
import { supabaseServer } from '@/lib/supabase/server'
import FiltersPanel from '@/app/jobs/_components/FiltersPanel'
import JobCard from '@/app/jobs/_components/JobCard'
import JobCardSkeleton from '@/app/jobs/_components/JobCardSkeleton'

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

export type JobsQuery = {
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

type JobsViewProps = {
  searchParams?: Promise<JobsQuery> | JobsQuery
  showHero?: boolean
  basePath?: string
  anchorId?: string
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

function buildBrowseHref(basePath: string, anchorId?: string) {
  const hash = anchorId ? `#${anchorId}` : ''
  return `${basePath}${hash}`
}

export function JobsViewSkeleton({ showHero = false }: { showHero?: boolean }) {
  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto h-7 w-72 max-w-full animate-pulse rounded-md bg-blue-100" />
              <div className="mx-auto mt-3 h-4 w-96 max-w-full animate-pulse rounded-md bg-slate-200" />
              <div className="mx-auto mt-6 h-10 w-44 animate-pulse rounded-md bg-blue-200" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 space-y-2">
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
              <div className="h-8 animate-pulse rounded bg-slate-100" />
            </div>
          </aside>

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <JobCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export default async function JobsView({
  searchParams,
  showHero = false,
  basePath = '/jobs',
  anchorId = 'internships',
}: JobsViewProps) {
  const resolvedSearchParams = ((searchParams ? await Promise.resolve(searchParams) : {}) ?? {}) as JobsQuery
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

  const internships = await fetchInternships()
  const newestInternships = internships.slice(0, 6)

  let sortedInternships = internships
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
    const listingType = getInternshipType(listing.hours_per_week)
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
  const listingsTitle = filteredInternships.length === 0 ? 'Browse internships' : 'Internships hiring now'

  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Find internships that fit your major and schedule.
              </h1>
              <p className="mt-3 text-sm text-slate-600 sm:text-base">
                Filter fast and start with roles you can actually apply to this term.
              </p>
              <div className="mt-6">
                <Link
                  href={`#${anchorId}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Browse internships
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section id={anchorId} className="mx-auto max-w-6xl scroll-mt-24 px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{listingsTitle}</h2>
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
            basePath={basePath}
            anchorId={anchorId}
          />

          <div className="space-y-4">
            {filteredInternships.length === 0 ? (
              <div className="space-y-6">
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-700">
                      ✦
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">No matches for these filters</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Try clearing filters or browsing all internships to see the newest opportunities.
                    </p>
                    <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                      <Link
                        href={buildBrowseHref(basePath, anchorId)}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Clear filters
                      </Link>
                      <Link
                        href={buildBrowseHref(basePath, anchorId)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Browse all internships
                      </Link>
                    </div>
                  </div>
                </div>

                {newestInternships.length > 0 ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">Newest internships</h3>
                      <Link href={buildBrowseHref(basePath, anchorId)} className="text-sm font-medium text-blue-700 hover:underline">
                        Browse all internships
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {newestInternships.map((listing) => (
                        <JobCard
                          key={listing.id}
                          listing={{
                            ...listing,
                            majorsText: formatMajors(listing.majors),
                            jobType: getInternshipType(listing.hours_per_week),
                          }}
                          isAuthenticated={Boolean(user)}
                          matchSignals={
                            user
                              ? getMatchSignals(listing, {
                                  profileMajors,
                                  profileAvailability,
                                  profileCoursework,
                                })
                              : []
                          }
                        />
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">No internships yet</h3>
                    <p className="mt-2 text-sm text-slate-600">Check back soon or create an account to get updates.</p>
                    <div className="mt-4">
                      <Link
                        href="/signup/student"
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Create account
                      </Link>
                    </div>
                  </section>
                )}
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
                      jobType: getInternshipType(listing.hours_per_week),
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
    </>
  )
}
