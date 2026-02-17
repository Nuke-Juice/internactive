import Link from 'next/link'
import { parseMajors, rankInternships } from '@/lib/matching'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getCommuteMinutesForListings, toGeoPoint } from '@/lib/commute'
import { fetchInternships, fetchInternshipsByIds, formatMajors, type Internship } from '@/lib/jobs/internships'
import { parseSponsoredInternshipIds, splitSponsoredListings } from '@/lib/jobs/sponsored'
import { normalizeStateCode } from '@/lib/locations/usLocationCatalog'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
import { supabaseServer } from '@/lib/supabase/server'
import { INTERNSHIP_CATEGORIES } from '@/lib/internships/categories'
import { getStudentCourseworkFeatures } from '@/lib/coursework/getStudentCourseworkFeatures'
import FiltersPanel from '@/app/jobs/_components/FiltersPanel'
import JobCard from '@/app/jobs/_components/JobCard'
import JobCardSkeleton from '@/app/jobs/_components/JobCardSkeleton'

const categoryTiles = [...INTERNSHIP_CATEGORIES]

export type JobsQuery = {
  sort?: string
  q?: string
  category?: string
  paymin?: string
  remote?: string
  exp?: string
  hmin?: string
  hmax?: string
  hmax_slider?: string
  city?: string
  state?: string
  loc?: string
  radius?: string
  page?: string
  applied?: string
}

type JobsViewProps = {
  searchParams?: Promise<JobsQuery> | JobsQuery
  showHero?: boolean
  basePath?: string
  anchorId?: string
}

type SortMode = 'best_match' | 'newest'

type JobsFilterState = {
  searchQuery: string
  category: string
  payMin: string
  remoteOnly: boolean
  experience: string
  hoursMin: string
  hoursMax: string
  locationCity: string
  locationState: string
  radius: string
}

type ActiveFilterDescriptor = {
  key: keyof JobsFilterState
  label: string
}

const SORT_CONFIG: Record<SortMode, { label: string; matchingSignals: string[] }> = {
  best_match: {
    label: 'Best match for you',
    matchingSignals: [
      'Major/category alignment',
      'Canonical coursework categories + strength',
      'Canonical skills overlap',
      'Work mode and location fit',
      'Hours and pay fit',
      'Year in school fit',
    ],
  },
  newest: {
    label: 'Newest',
    matchingSignals: [],
  },
}

function normalizeSort(value: string | undefined, _isStudent: boolean): SortMode {
  if (value === 'best_match' || value === 'newest') {
    return value
  }
  return 'best_match'
}

function withSearchParams(basePath: string, params: URLSearchParams, anchorId?: string) {
  const query = params.toString()
  const hash = anchorId ? `#${anchorId}` : ''
  return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`
}

function buildBrowseHref(basePath: string, anchorId?: string) {
  const hash = anchorId ? `#${anchorId}` : ''
  return `${basePath}${hash}`
}

function parseCityState(value: string | null | undefined) {
  if (!value) return { city: null as string | null, state: null as string | null }
  const cleaned = value.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!cleaned) return { city: null as string | null, state: null as string | null }
  const [cityRaw, stateRaw] = cleaned.split(',').map((part) => part.trim())
  const state = stateRaw ? stateRaw.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() : null
  return {
    city: cityRaw || null,
    state: state && state.length === 2 ? state : null,
  }
}

function canonicalMajorName(value: unknown) {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: unknown } | undefined
    return typeof first?.name === 'string' ? first.name : null
  }
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { name?: unknown }
    return typeof maybe.name === 'string' ? maybe.name : null
  }
  return null
}

function extractNumericPayRange(pay: string | null | undefined) {
  if (!pay) return null
  const matches = pay.match(/(\d+(?:\.\d+)?)/g)
  if (!matches || matches.length === 0) return null
  const values = matches.map((value) => Number(value)).filter((value) => Number.isFinite(value))
  if (values.length === 0) return null
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

function matchesListingFilters(listing: Internship, filters: JobsFilterState) {
  const listingMajors = parseMajors(listing.majors)
  const normalizedTitle = listing.title?.toLowerCase() ?? ''
  const normalizedCompany = listing.company_name?.toLowerCase() ?? ''
  const normalizedDescription = listing.description?.toLowerCase() ?? ''
  const normalizedCategoryText = (listing.category ?? listing.role_category ?? '').toLowerCase()
  const isRemote = (listing.location ?? '').toLowerCase().includes('remote')
  const listingExperience = (listing.target_student_year ?? listing.experience_level ?? '').toLowerCase()
  const parsedMinHours = filters.hoursMin ? Number(filters.hoursMin) : null
  const parsedMaxHours = filters.hoursMax ? Number(filters.hoursMax) : null
  const listingPayRange =
    typeof listing.pay_min === 'number' && typeof listing.pay_max === 'number'
      ? { min: listing.pay_min, max: listing.pay_max }
      : extractNumericPayRange(listing.pay)
  const normalizedLocationCity = filters.locationCity.toLowerCase()
  const normalizedLocationState = filters.locationState.toLowerCase()
  const parsedRadius =
    filters.radius === '10' || filters.radius === '25' || filters.radius === '50' || filters.radius === '100'
      ? Number(filters.radius)
      : 0
  const listingCity = (listing.location_city ?? '').toLowerCase()
  const listingState = (listing.location_state ?? '').toLowerCase()
  const parsedPayMin = filters.payMin ? Number(filters.payMin) : null

  if (filters.searchQuery) {
    const normalizedSearchQuery = filters.searchQuery.toLowerCase()
    const internshipMatches =
      normalizedTitle.includes(normalizedSearchQuery) ||
      normalizedDescription.includes(normalizedSearchQuery) ||
      normalizedCategoryText.includes(normalizedSearchQuery)
    const employerMatches = normalizedCompany.includes(normalizedSearchQuery)
    if (!internshipMatches && !employerMatches) return false
  }

  if (filters.category) {
    const normalizedCategory = filters.category.toLowerCase()
    const listingCategory = (listing.category ?? listing.role_category ?? '').toLowerCase()
    const hasCategoryMatch =
      listingCategory === normalizedCategory ||
      listingMajors.some((major) => major.includes(normalizedCategory)) ||
      normalizedTitle.includes(normalizedCategory)
    if (!hasCategoryMatch) return false
  }

  if (typeof parsedPayMin === 'number' && Number.isFinite(parsedPayMin) && parsedPayMin > 0) {
    if (!listingPayRange || listingPayRange.max < parsedPayMin) return false
  }

  if (filters.remoteOnly && !isRemote) return false
  if (filters.experience && listingExperience !== filters.experience) return false

  const listingHoursMin = typeof listing.hours_min === 'number' ? listing.hours_min : listing.hours_per_week
  const listingHoursMax = typeof listing.hours_max === 'number' ? listing.hours_max : listing.hours_per_week
  if (typeof parsedMinHours === 'number' && Number.isFinite(parsedMinHours) && typeof listingHoursMax === 'number') {
    if (listingHoursMax < parsedMinHours) return false
  }
  if (typeof parsedMaxHours === 'number' && Number.isFinite(parsedMaxHours) && typeof listingHoursMin === 'number') {
    if (listingHoursMin > parsedMaxHours) return false
  }

  if (normalizedLocationState && listingState !== normalizedLocationState) return false
  if (normalizedLocationCity) {
    const directCityMatch = listingCity.includes(normalizedLocationCity)
    const relaxedRadiusMatch =
      parsedRadius >= 25 &&
      normalizedLocationState.length > 0 &&
      !directCityMatch &&
      listingState === normalizedLocationState
    if (!directCityMatch && !relaxedRadiusMatch) return false
  }

  return true
}

function getActiveFilterDescriptors(filters: JobsFilterState) {
  const candidates: ActiveFilterDescriptor[] = [
    { key: 'searchQuery', label: 'Search' },
    { key: 'category', label: 'Category' },
    { key: 'payMin', label: 'Pay range' },
    { key: 'remoteOnly', label: 'Work mode' },
    { key: 'experience', label: 'Year in school' },
    { key: 'hoursMin', label: 'Hours min' },
    { key: 'hoursMax', label: 'Hours max' },
    { key: 'locationCity', label: 'Location (city)' },
    { key: 'locationState', label: 'Location (state)' },
    { key: 'radius', label: 'Radius' },
  ]
  return candidates.filter((item) => Boolean(filters[item.key]))
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
  const showBrowseHeroButton = basePath !== '/'
  const resolvedSearchParams = ((searchParams ? await Promise.resolve(searchParams) : {}) ?? {}) as JobsQuery
  const requestedSortRaw = resolvedSearchParams.sort
  const searchQuery = (resolvedSearchParams.q ?? '').trim()
  const activeCategory = resolvedSearchParams.category ?? ''
  const payMin = resolvedSearchParams.paymin ?? ''
  const remoteOnly = resolvedSearchParams.remote === '1'
  const selectedExperience = resolvedSearchParams.exp ?? ''
  const hoursMin = resolvedSearchParams.hmin ?? ''
  const hoursMax = resolvedSearchParams.hmax?.trim() || resolvedSearchParams.hmax_slider?.trim() || ''
  const legacyLocation = parseCityState((resolvedSearchParams.loc ?? '').trim())
  const locationCity = (resolvedSearchParams.city ?? legacyLocation.city ?? '').trim()
  const locationState = normalizeStateCode(resolvedSearchParams.state ?? legacyLocation.state ?? '')
  const radius = resolvedSearchParams.radius ?? ''
  const parsedPage = Number.parseInt((resolvedSearchParams.page ?? '1').trim(), 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const internshipsResult = await fetchInternships({
    page,
    limit: 60,
    filters: {
      searchQuery,
      category: activeCategory,
      remoteOnly,
      experience: selectedExperience,
      locationCity,
      locationState,
    },
  })
  const internships = internshipsResult.rows
  const employerIdsForResponseStats = Array.from(
    new Set(
      internships
        .map((listing) => listing.employer_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )
  const { data: employerResponseRows } =
    employerIdsForResponseStats.length > 0
      ? await supabase
          .from('employer_response_rate_stats')
          .select('employer_id, applications_total, viewed_within_7d_rate')
          .in('employer_id', employerIdsForResponseStats)
      : { data: [] as Array<{ employer_id: string; applications_total: number; viewed_within_7d_rate: number | null }> }
  const employerResponseById = new Map(
    (employerResponseRows ?? []).map((row) => [
      row.employer_id,
      {
        applicationsTotal: typeof row.applications_total === 'number' ? row.applications_total : 0,
        viewedWithin7dRate: typeof row.viewed_within_7d_rate === 'number' ? row.viewed_within_7d_rate : null,
      },
    ])
  )
  const hasMoreResults = internshipsResult.hasMore
  const newestInternships = internships.slice(0, 6)
  const filters: JobsFilterState = {
    searchQuery,
    category: activeCategory,
    payMin,
    remoteOnly,
    experience: selectedExperience,
    hoursMin,
    hoursMax,
    locationCity,
    locationState,
    radius,
  }

  let activeSortMode: SortMode = 'newest'
  let profileMajors: string[] = []
  let profileYear: string | null = null
  let profileExperienceLevel: string | null = null
  let profileAvailability: number | null = null
  let profileAvailabilityStartMonth: string | null = null
  let profileCoursework: string[] = []
  let profileSkills: string[] = []
  let profileSkillIds: string[] = []
  let profileCourseworkItemIds: string[] = []
  let profileCourseworkCategoryIds: string[] = []
  let profileCanonicalCourseworkCategoryIds: string[] = []
  let profileCanonicalCourseworkCategoryNames: string[] = []
  let profileCanonicalCourseLevelBands: Array<'intro' | 'intermediate' | 'advanced'> = []
  let preferenceSignals = parseStudentPreferenceSignals(null)
  let studentTransportMode: string | null = null
  let studentMaxCommuteMinutes: number | null = null
  let studentLocation: { city: string | null; state: string | null; zip: string | null; point: { lat: number; lng: number } | null } = {
    city: null,
    state: null,
    zip: null,
    point: null,
  }
  const whyMatchById = new Map<string, string[]>()
  const commuteMinutesById = new Map<string, number>()
  const employerAvatarById = new Map<string, string | null>()
  let role: 'student' | 'employer' | undefined

  if (user) {
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (userRow?.role === 'student' || userRow?.role === 'employer') {
      role = userRow.role
    }

    const fullProfileSelect =
      'university_id, school, major_id, major:canonical_majors(id, slug, name), majors, year, coursework, coursework_unverified, experience_level, availability_start_month, availability_hours_per_week, interests, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, location_lat, location_lng'
    const fallbackProfileSelect =
      'university_id, school, major_id, major:canonical_majors(id, slug, name), majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week, interests, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode'
    const profileResult = await supabase
      .from('student_profiles')
      .select(fullProfileSelect)
      .eq('user_id', user.id)
      .maybeSingle()
    const profile =
      profileResult.error &&
      profileResult.error.message.toLowerCase().includes('schema cache')
        ? (
            await supabase
              .from('student_profiles')
              .select(fallbackProfileSelect)
              .eq('user_id', user.id)
              .maybeSingle()
          ).data
        : profileResult.data
    const [{ data: studentSkillRows }, courseworkFeatures] = await Promise.all([
      supabase.from('student_skill_items').select('skill_id, skill:skills(label)').eq('student_id', user.id),
      getStudentCourseworkFeatures({
        supabase,
        studentId: user.id,
        profileCoursework: profile?.coursework,
        profileCourseworkUnverified:
          profile && typeof profile === 'object' && 'coursework_unverified' in profile
            ? (profile as { coursework_unverified?: unknown }).coursework_unverified
            : undefined,
      }),
    ])

    const profileMajorName = canonicalMajorName(profile?.major)
    profileMajors = profileMajorName ? parseMajors([profileMajorName]) : parseMajors(profile?.majors ?? null)
    profileYear = profile?.year ?? null
    profileExperienceLevel = profile?.experience_level ?? null
    profileAvailability = profile?.availability_hours_per_week ?? null
    profileAvailabilityStartMonth = profile?.availability_start_month ?? null
    profileCoursework = courseworkFeatures.textCoursework
      ? courseworkFeatures.textCoursework
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const canonicalSkillLabels = (studentSkillRows ?? [])
      .map((row) => {
        const skill = row.skill as { label?: string | null } | null
        return typeof skill?.label === 'string' ? skill.label : ''
      })
      .filter((value): value is string => value.length > 0)
    preferenceSignals = parseStudentPreferenceSignals(profile?.interests ?? null)
    profileSkills = Array.from(new Set([...preferenceSignals.skills, ...canonicalSkillLabels]))
    studentTransportMode = typeof profile?.transport_mode === 'string' ? profile.transport_mode : 'driving'
    studentMaxCommuteMinutes = typeof profile?.max_commute_minutes === 'number' ? profile.max_commute_minutes : null
    studentLocation = {
      city: typeof profile?.preferred_city === 'string' ? profile.preferred_city : null,
      state: typeof profile?.preferred_state === 'string' ? profile.preferred_state : null,
      zip: typeof profile?.preferred_zip === 'string' ? profile.preferred_zip : null,
      point: toGeoPoint(
        profile && typeof profile === 'object' && 'location_lat' in profile && typeof profile.location_lat === 'number'
          ? profile.location_lat
          : null,
        profile && typeof profile === 'object' && 'location_lng' in profile && typeof profile.location_lng === 'number'
          ? profile.location_lng
          : null
      ),
    }
    profileSkillIds = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')
    profileCourseworkItemIds = courseworkFeatures.legacyItemIds
    profileCourseworkCategoryIds = courseworkFeatures.legacyCategoryIds
    profileCanonicalCourseworkCategoryIds = courseworkFeatures.canonicalCategoryIds
    profileCanonicalCourseworkCategoryNames = courseworkFeatures.canonicalCategoryNames
    profileCanonicalCourseLevelBands = courseworkFeatures.canonicalCourseLevelBands

    if (role === 'student') {
      let completionProfile = profile as
        | {
            university_id?: string | number | null
            school?: string | null
            major_id?: string | null
            major?: unknown
            majors?: string[] | string | null
            year?: string | null
            coursework?: string[] | string | null
            experience_level?: string | null
            availability_start_month?: string | null
            availability_hours_per_week?: number | string | null
          }
        | null

      if (!completionProfile) {
        const minimalCompletionResult = await supabase
          .from('student_profiles')
          .select('university_id, school, major_id, majors, year, coursework, experience_level, availability_start_month, availability_hours_per_week')
          .eq('user_id', user.id)
          .maybeSingle()
        completionProfile = minimalCompletionResult.data ?? null
      }

      if (completionProfile) {
      }
    }

  }

  const isStudent = role === 'student'
  activeSortMode = normalizeSort(requestedSortRaw, isStudent)

  const filteredCandidates = internships.filter((listing) => matchesListingFilters(listing, filters))

  let filteredInternships = filteredCandidates
  let rankedMatches: ReturnType<typeof rankInternships> = []

  if (activeSortMode === 'best_match') {
    rankedMatches = rankInternships(
      filteredCandidates.map((listing) => ({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        majors: listing.majors,
        target_graduation_years: listing.target_graduation_years,
        experience_level: listing.target_student_year ?? listing.experience_level,
        target_student_year: listing.target_student_year ?? listing.experience_level,
        desired_coursework_strength: listing.desired_coursework_strength ?? null,
        category: listing.role_category ?? listing.category ?? null,
        hours_per_week: listing.hours_per_week,
        location: listing.location,
        work_mode: listing.work_mode,
        term: listing.term,
        required_skills: listing.required_skills,
        preferred_skills: listing.preferred_skills,
        recommended_coursework: listing.recommended_coursework,
        required_skill_ids: listing.required_skill_ids,
        preferred_skill_ids: listing.preferred_skill_ids,
        required_course_category_ids: listing.required_course_category_ids,
        required_course_category_names: listing.required_course_category_names,
        coursework_item_ids: listing.coursework_item_ids,
        coursework_category_ids: listing.coursework_category_ids,
        coursework_category_names: listing.coursework_category_names,
        start_date: listing.start_date ?? null,
        application_deadline: listing.application_deadline ?? null,
      })),
      {
        majors: profileMajors,
        year: profileYear,
        experience_level: profileExperienceLevel,
        skills: profileSkills,
        skill_ids: profileSkillIds,
        canonical_coursework_category_ids: profileCanonicalCourseworkCategoryIds,
        canonical_coursework_category_names: profileCanonicalCourseworkCategoryNames,
        canonical_coursework_level_bands: profileCanonicalCourseLevelBands,
        coursework_item_ids: profileCourseworkItemIds,
        coursework_category_ids: profileCourseworkCategoryIds,
        coursework: profileCoursework,
        availability_hours_per_week: profileAvailability,
        availability_start_month: profileAvailabilityStartMonth,
        preferred_terms:
          preferenceSignals.preferredTerms.length > 0
            ? preferenceSignals.preferredTerms
            : [],
        preferred_locations: preferenceSignals.preferredLocations,
        preferred_work_modes: preferenceSignals.preferredWorkModes,
        remote_only: preferenceSignals.remoteOnly,
      }
    )

    const listingById = new Map(filteredCandidates.map((listing) => [listing.id, listing]))
    filteredInternships = rankedMatches
      .map((item) => {
        const listing = listingById.get(item.internship.id)
        if (!listing) return null
        whyMatchById.set(item.internship.id, item.match.reasons.slice(0, 3))
        return { ...listing, matchScore: item.match.score }
      })
      .filter((listing): listing is Internship & { matchScore: number } => Boolean(listing))
  } else {
    filteredInternships = [...filteredCandidates].sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
  }

  const sponsoredInternshipIds = parseSponsoredInternshipIds(process.env.SPONSORED_INTERNSHIP_IDS)
  let sponsoredInternships: Internship[] = []
  if (sponsoredInternshipIds.length > 0) {
    const fetchedSponsored = (await fetchInternshipsByIds(sponsoredInternshipIds))
      .filter((listing) => !(isStudent && preferenceSignals.remoteOnly && listing.work_mode !== 'remote'))
    const split = splitSponsoredListings({
      sponsoredListings: fetchedSponsored,
      organicListings: filteredInternships,
      maxSponsored: 3,
    })
    sponsoredInternships = split.sponsored
    filteredInternships = split.organic
  }

  const topBestMatchIds = new Set(
    isStudent && activeSortMode === 'best_match'
      ? filteredInternships.slice(0, 3).map((listing) => listing.id)
      : []
  )

  if (user && role === 'student' && filteredInternships.length > 0) {
    const employerIds = Array.from(
      new Set(
        filteredInternships
          .map((listing) => listing.employer_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    )
    const { data: employerProfiles } =
      employerIds.length > 0
        ? await supabase
            .from('employer_profiles')
            .select('user_id, location, avatar_url')
            .in('user_id', employerIds)
        : { data: [] as Array<{ user_id: string; location: string | null; avatar_url: string | null }> }

    const employerLocationById = new Map(
      (employerProfiles ?? []).map((row) => {
        const parsed = parseCityState(row.location ?? null)
        return [
          row.user_id,
          {
            city: parsed.city,
            state: parsed.state,
            zip: null as string | null,
            point: null as { lat: number; lng: number } | null,
          },
        ]
      })
    )
    for (const row of employerProfiles ?? []) {
      if (typeof row.user_id === 'string') {
        employerAvatarById.set(row.user_id, typeof row.avatar_url === 'string' ? row.avatar_url : null)
      }
    }

    const commuteMap = await getCommuteMinutesForListings({
      supabase,
      userId: user.id,
      origin: studentLocation,
      transportMode: studentTransportMode,
      destinations: filteredInternships.map((listing) => {
        const employerLocation = listing.employer_id ? employerLocationById.get(listing.employer_id) : undefined
        return {
          internshipId: listing.id,
          workMode: listing.work_mode,
          city: listing.location_city ?? null,
          state: listing.location_state ?? null,
          zip: null,
          point: null,
          fallbackCity: employerLocation?.city ?? listing.location_city,
          fallbackState: employerLocation?.state ?? listing.location_state,
          fallbackZip: employerLocation?.zip ?? null,
          fallbackPoint: employerLocation?.point ?? null,
        }
      }),
    })

    for (const [internshipId, minutes] of commuteMap.entries()) {
      commuteMinutesById.set(internshipId, minutes)
    }
  }

  const activeFilterDescriptors = getActiveFilterDescriptors(filters)
  const activeFilterCount = activeFilterDescriptors.length
  const suggestedNoResultFilters = (() => {
    if (filteredInternships.length > 0 || activeFilterDescriptors.length === 0) return [] as ActiveFilterDescriptor[]

    const scored = activeFilterDescriptors
      .map((descriptor) => {
        const stripped: JobsFilterState = { ...filters }
        if (descriptor.key === 'remoteOnly') stripped.remoteOnly = false
        if (descriptor.key === 'searchQuery') stripped.searchQuery = ''
        if (descriptor.key === 'category') stripped.category = ''
        if (descriptor.key === 'payMin') stripped.payMin = ''
        if (descriptor.key === 'experience') stripped.experience = ''
        if (descriptor.key === 'hoursMin') stripped.hoursMin = ''
        if (descriptor.key === 'hoursMax') stripped.hoursMax = ''
        if (descriptor.key === 'locationCity') stripped.locationCity = ''
        if (descriptor.key === 'locationState') stripped.locationState = ''
        if (descriptor.key === 'radius') stripped.radius = ''
        const count = internships.filter((listing) => matchesListingFilters(listing, stripped)).length
        return { descriptor, increase: count }
      })
      .sort((a, b) => b.increase - a.increase)

    const positive = scored.filter((item) => item.increase > 0).slice(0, 2).map((item) => item.descriptor)
    if (positive.length > 0) return positive
    return activeFilterDescriptors.slice(0, 2)
  })()

  const isHeavyFiltering = activeFilterCount >= 4
  const shouldShowResetToMatchedView =
    isStudent && (activeSortMode === 'newest' || isHeavyFiltering)

  const preservedQueryParams = new URLSearchParams()
  if (searchQuery) preservedQueryParams.set('q', searchQuery)
  if (activeCategory) preservedQueryParams.set('category', activeCategory)
  if (payMin) preservedQueryParams.set('paymin', payMin)
  if (remoteOnly) preservedQueryParams.set('remote', '1')
  if (selectedExperience) preservedQueryParams.set('exp', selectedExperience)
  if (hoursMin) preservedQueryParams.set('hmin', hoursMin)
  if (hoursMax) preservedQueryParams.set('hmax', hoursMax)
  if (locationCity) preservedQueryParams.set('city', locationCity)
  if (locationState) preservedQueryParams.set('state', locationState)
  if (radius) preservedQueryParams.set('radius', radius)

  const previousPageHref = (() => {
    const params = new URLSearchParams(preservedQueryParams)
    if (activeSortMode === 'best_match') params.set('sort', 'best_match')
    if (activeSortMode === 'newest') params.set('sort', 'newest')
    const previousPage = Math.max(1, page - 1)
    if (previousPage > 1) params.set('page', String(previousPage))
    return withSearchParams(basePath, params, anchorId)
  })()
  const nextPageHref = (() => {
    const params = new URLSearchParams(preservedQueryParams)
    if (activeSortMode === 'best_match') params.set('sort', 'best_match')
    if (activeSortMode === 'newest') params.set('sort', 'newest')
    params.set('page', String(page + 1))
    return withSearchParams(basePath, params, anchorId)
  })()

  const clearSuggestedFiltersHref = (() => {
    if (suggestedNoResultFilters.length === 0) return withSearchParams(basePath, preservedQueryParams, anchorId)
    const params = new URLSearchParams(preservedQueryParams)
    for (const descriptor of suggestedNoResultFilters) {
      if (descriptor.key === 'remoteOnly') {
        params.delete('remote')
      } else if (descriptor.key === 'searchQuery') {
        params.delete('q')
      } else if (descriptor.key === 'category') {
        params.delete('category')
      } else if (descriptor.key === 'payMin') {
        params.delete('paymin')
      } else if (descriptor.key === 'experience') {
        params.delete('exp')
      } else if (descriptor.key === 'hoursMin') {
        params.delete('hmin')
      } else if (descriptor.key === 'hoursMax') {
        params.delete('hmax')
      } else if (descriptor.key === 'locationCity') {
        params.delete('city')
      } else if (descriptor.key === 'locationState') {
        params.delete('state')
      } else if (descriptor.key === 'radius') {
        params.delete('radius')
      }
    }
    return withSearchParams(basePath, params, anchorId)
  })()

  const noMatchesHint =
    filteredInternships.length === 0 && activeFilterDescriptors.length > 0
      ? {
          labels: suggestedNoResultFilters.map((item) => item.label),
          clearSuggestedHref: clearSuggestedFiltersHref,
          resetAllHref: buildBrowseHref(basePath, anchorId),
        }
      : null

  const bestMatchHref = (() => {
    const params = new URLSearchParams(preservedQueryParams)
    params.set('sort', 'best_match')
    return withSearchParams(basePath, params, anchorId)
  })()
  const newestHref = (() => {
    const params = new URLSearchParams(preservedQueryParams)
    params.set('sort', 'newest')
    return withSearchParams(basePath, params, anchorId)
  })()

  const resetMatchedViewHref = (() => {
    const params = new URLSearchParams()
    params.set('sort', 'best_match')
    return withSearchParams(basePath, params, anchorId)
  })()

  const sortedByLabel = SORT_CONFIG[activeSortMode].label
  const listingsTitle = filteredInternships.length === 0 ? 'Browse internships' : 'Internships hiring now'
  const compactSignedInHero = showHero && Boolean(user)
  const exposureDay = new Date().toISOString().slice(0, 10)
  const exposureUser = user?.id ?? 'anon'

  await trackAnalyticsEvent({
    eventName: 'jobs_feed_exposure_organic',
    userId: user?.id ?? null,
    properties: {
      sort: activeSortMode,
      page,
      listing_ids: filteredInternships.map((listing) => listing.id),
      dedupe_key: `jobs_feed_exposure_organic:${activeSortMode}:${page}:${exposureUser}:${exposureDay}`,
    },
  })
  if (sponsoredInternships.length > 0) {
    await trackAnalyticsEvent({
      eventName: 'jobs_feed_exposure_sponsored',
      userId: user?.id ?? null,
      properties: {
        sort: activeSortMode,
        page,
        listing_ids: sponsoredInternships.map((listing) => listing.id),
        dedupe_key: `jobs_feed_exposure_sponsored:${activeSortMode}:${page}:${exposureUser}:${exposureDay}`,
      },
    })
  }

  return (
    <>
      {showHero ? (
        <section className="border-b border-blue-100 bg-gradient-to-b from-blue-50 to-slate-50">
          <div className={`mx-auto max-w-6xl px-6 ${compactSignedInHero ? 'py-5' : 'py-10'}`}>
            <div className="mx-auto max-w-3xl text-center">
              <h1 className={`font-semibold tracking-tight text-slate-900 ${compactSignedInHero ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
                {user
                  ? 'Internships made for you'
                  : 'Create profile to get specialized internships matched to you.'}
              </h1>
              <p className={`${compactSignedInHero ? 'mt-1.5' : 'mt-3'} text-sm text-slate-600 sm:text-base`}>
                {user
                  ? 'Filter fast and start with roles you can actually apply to this term.'
                  : 'Browse first, then create your profile for better match ranking.'}
              </p>
              <div className={`${compactSignedInHero ? 'mt-3' : 'mt-6'} flex flex-wrap items-center justify-center gap-2`}>
                {showBrowseHeroButton && (
                  <Link
                    href={`#${anchorId}`}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Browse internships
                  </Link>
                )}
                {!user && (
                  <Link
                    href="/signup/student"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create profile
                  </Link>
                )}
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
            {isStudent ? (
              <div className="flex items-center justify-end gap-2">
                <Link
                  href={bestMatchHref}
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 ${
                    activeSortMode === 'best_match'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Best match {activeSortMode === 'best_match' ? '✓' : ''}
                </Link>
                <Link
                  href={newestHref}
                  className={`inline-flex items-center rounded-md border px-2.5 py-1 ${
                    activeSortMode === 'newest'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Newest {activeSortMode === 'newest' ? '✓' : ''}
                </Link>
              </div>
            ) : null}
            <div className="mt-1 flex items-center justify-end gap-1">
              <span>Sorted by: {sortedByLabel}</span>
              {activeSortMode === 'best_match' ? (
                <span
                  title="Based on your major, experience, and preferences"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500"
                >
                  i
                </span>
              ) : null}
            </div>
            {shouldShowResetToMatchedView ? (
              <div className="mt-1">
                <Link href={resetMatchedViewHref} className="text-blue-700 hover:underline">
                  Reset to matched view
                </Link>
              </div>
            ) : null}
            <div className="mt-1">{filteredInternships.length} results</div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <Link
                href={previousPageHref}
                className={`inline-flex items-center rounded-md border px-2.5 py-1 ${page <= 1 ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Prev
              </Link>
              <span className="text-xs text-slate-500">Page {page}</span>
              <Link
                href={nextPageHref}
                className={`inline-flex items-center rounded-md border px-2.5 py-1 ${!hasMoreResults ? 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[290px_1fr]">
          <FiltersPanel
            categories={categoryTiles}
            state={{
              sort: activeSortMode,
              searchQuery,
              category: activeCategory,
              payMin,
              remoteOnly,
              experience: selectedExperience,
              hoursMin,
              hoursMax,
              locationCity,
              locationState,
              radius,
            }}
            noMatchesHint={noMatchesHint}
            basePath={basePath}
            anchorId={anchorId}
          />

          <div className="space-y-4">
            {sponsoredInternships.length > 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-900">Sponsored</h3>
                <div className="mt-3 space-y-4">
                  {sponsoredInternships.map((listing) => {
                    const responseStats = listing.employer_id ? employerResponseById.get(listing.employer_id) : undefined
                    return (
                      <JobCard
                        key={`sponsored-${listing.id}`}
                        listing={{
                          ...listing,
                          experience_level: listing.target_student_year ?? listing.experience_level,
                          majorsText: formatMajors(listing.majors),
                          commuteMinutes: commuteMinutesById.get(listing.id) ?? null,
                          maxCommuteMinutes: studentMaxCommuteMinutes,
                          employer_response_rate: responseStats?.viewedWithin7dRate ?? null,
                          employer_response_total: responseStats?.applicationsTotal ?? 0,
                          employer_avatar_url: listing.employer_id ? employerAvatarById.get(listing.employer_id) ?? null : null,
                        }}
                        isAuthenticated={Boolean(user)}
                        userRole={role ?? null}
                        showMatchPrompt={!user}
                        showWhyMatch={false}
                        whyMatchReasons={[]}
                        isSponsored
                      />
                    )
                  })}
                </div>
              </section>
            ) : null}
            {internships.length === 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">No internships yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {user
                    ? 'Check back soon for new opportunities.'
                    : 'Check back soon or create an account to get updates.'}
                </p>
                {!user && (
                  <div className="mt-4">
                    <Link
                      href="/signup/student"
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Create account
                    </Link>
                  </div>
                )}
              </section>
            ) : filteredInternships.length === 0 ? (
              <div className="space-y-6">
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-lg text-blue-700">
                      ✦
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-900">No matches for these filters</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      Try clearing filters or adjusting your search to see matching opportunities.
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

                {newestInternships.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">Newest internships</h3>
                      <Link href={buildBrowseHref(basePath, anchorId)} className="text-sm font-medium text-blue-700 hover:underline">
                        Browse all internships
                      </Link>
                    </div>
                    <div className={`mt-4 grid gap-4 ${newestInternships.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                      {newestInternships.map((listing) => {
                        const responseStats = listing.employer_id ? employerResponseById.get(listing.employer_id) : undefined
                        return (
                          <JobCard
                            key={listing.id}
                            listing={{
                              ...listing,
                              experience_level: listing.target_student_year ?? listing.experience_level,
                              majorsText: formatMajors(listing.majors),
                              commuteMinutes: commuteMinutesById.get(listing.id) ?? null,
                              maxCommuteMinutes: studentMaxCommuteMinutes,
                              employer_response_rate: responseStats?.viewedWithin7dRate ?? null,
                              employer_response_total: responseStats?.applicationsTotal ?? 0,
                              employer_avatar_url: listing.employer_id ? employerAvatarById.get(listing.employer_id) ?? null : null,
                            }}
                            isAuthenticated={Boolean(user)}
                            userRole={role ?? null}
                            showMatchPrompt={!user}
                            showWhyMatch={topBestMatchIds.has(listing.id)}
                            whyMatchReasons={whyMatchById.get(listing.id) ?? []}
                            isSponsored={false}
                          />
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              filteredInternships.map((listing) => {
                const responseStats = listing.employer_id ? employerResponseById.get(listing.employer_id) : undefined
                return (
                  <JobCard
                    key={listing.id}
                    listing={{
                      ...listing,
                      experience_level: listing.target_student_year ?? listing.experience_level,
                      majorsText: formatMajors(listing.majors),
                      commuteMinutes: commuteMinutesById.get(listing.id) ?? null,
                      maxCommuteMinutes: studentMaxCommuteMinutes,
                      employer_response_rate: responseStats?.viewedWithin7dRate ?? null,
                      employer_response_total: responseStats?.applicationsTotal ?? 0,
                      employer_avatar_url: listing.employer_id ? employerAvatarById.get(listing.employer_id) ?? null : null,
                    }}
                    isAuthenticated={Boolean(user)}
                    userRole={role ?? null}
                    showMatchPrompt={!user}
                    showWhyMatch={topBestMatchIds.has(listing.id)}
                    whyMatchReasons={whyMatchById.get(listing.id) ?? []}
                    isSponsored={false}
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
