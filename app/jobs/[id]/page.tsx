import Link from 'next/link'
import { ArrowLeft, FileText, ShieldCheck, Star, Users } from 'lucide-react'
import EmployerVerificationBadge from '@/components/badges/EmployerVerificationBadge'
import MatchScoreCircleButton from '@/components/jobs/MatchScoreCircleButton'
import { getMatchScoreTone } from '@/components/jobs/getMatchScoreTone'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getCommuteMinutesForListings, toGeoPoint } from '@/lib/commute'
import { supabaseServer } from '@/lib/supabase/server'
import { evaluateInternshipMatch, MATCH_SIGNAL_DEFINITIONS, parseMajors } from '@/lib/matching'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
import { normalizeSeason } from '@/lib/availability/normalizeSeason'
import { normalizeListingCoursework } from '@/lib/coursework/normalizeListingCoursework'
import { getStudentCourseworkFeatures } from '@/lib/coursework/getStudentCourseworkFeatures'
import { formatCompleteness } from '@/src/profile/profileCompleteness'
import { getStudentProfileCompleteness } from '@/src/profile/getStudentProfileCompleteness'
import { getInternshipById } from '@/lib/jobs/getInternshipById'
import ApplyModalLauncher from '../_components/ApplyModalLauncher'

function formatMajors(value: string[] | string | null) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(', ')
  return value
}

function formatTargetYear(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'any') return 'Any year'
  if (normalized === 'freshman') return 'Freshman'
  if (normalized === 'sophomore') return 'Sophomore'
  if (normalized === 'junior') return 'Junior'
  if (normalized === 'senior') return 'Senior'
  return value
}

function fallbackPreferredLocation(city: string | null | undefined, state: string | null | undefined) {
  const normalizedCity = (city ?? '').trim()
  const normalizedState = (state ?? '').trim().toUpperCase()
  if (!normalizedCity || !normalizedState) return ''
  return `${normalizedCity}, ${normalizedState}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCompensationLine(listing: {
  pay_min?: number | null
  pay_max?: number | null
  compensation_currency?: string | null
  compensation_interval?: string | null
  compensation_is_estimated?: boolean | null
  bonus_eligible?: boolean | null
}) {
  const min = typeof listing.pay_min === 'number' ? listing.pay_min : null
  const max = typeof listing.pay_max === 'number' ? listing.pay_max : null
  if (min === null && max === null) return null
  const currency = (listing.compensation_currency ?? 'USD').trim().toUpperCase() || 'USD'
  const interval = (listing.compensation_interval ?? 'hour').trim().toLowerCase()
  const suffix = interval === 'week' ? '/wk' : interval === 'month' ? '/mo' : interval === 'year' ? '/yr' : '/hr'
  const range = min !== null && max !== null ? `${min}-${max}` : String(min ?? max)
  const flags: string[] = []
  if (listing.compensation_is_estimated) flags.push('estimated')
  if (listing.bonus_eligible) flags.push('bonus eligible')
  const tail = flags.length > 0 ? ` (${flags.join(', ')})` : ''
  return `${currency} ${range}${suffix}${tail}`
}

function parseDashedBullets(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return []
  const lines = raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const bullets = lines
    .filter((line) => /^[-*•]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, '').trim())
    .filter((line) => !/^(responsibilities|qualifications)\s*:/i.test(line))
    .filter((line) => line.length >= 3 && line.length <= 220)

  if (bullets.length >= 2) return bullets.slice(0, 10)

  const fallback = raw
    .replace(/\s+/g, ' ')
    .split(/\s+(?:-|•)\s+/)
    .map((part) => part.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean)
    .filter((line) => !/^(responsibilities|qualifications)\s*:/i.test(line))
    .filter((line) => line.length >= 5 && line.length <= 180)

  if (fallback.length < 2) return []
  return fallback.slice(0, 10)
}

function parseScreeningQuestion(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/screening question:\s*([^\n\r]+)/i)
  if (!match?.[1]) return null
  const prompt = match[1].trim()
  return prompt.length > 0 ? prompt : null
}

function normalizeSkillChipToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function scoreLabel(score: number | null) {
  if (score === null) {
    return { title: 'How you match', badge: 'Match pending', tone: 'pending' as const }
  }
  if (score >= 60) return { title: "Why you're a strong match", badge: `${score}% match`, tone: 'high' as const }
  if (score >= 20) return { title: 'How you match', badge: `${score}% match`, tone: 'medium' as const }
  return { title: 'Match details', badge: 'Low match', tone: 'low' as const }
}

function gapCta(gap: string) {
  const normalized = gap.toLowerCase()
  if (normalized.includes('missing required skills')) {
    return { href: '/account#skills', label: 'Add skills' }
  }
  if (normalized.includes('hours exceed availability') || normalized.includes('availability') || normalized.includes('late start')) {
    return { href: '/account#availability', label: 'Update availability' }
  }
  if (
    normalized.includes('location mismatch') ||
    normalized.includes('work mode mismatch') ||
    normalized.includes('requires in-person')
  ) {
    return { href: '/account#preferences', label: 'Update preferences' }
  }
  return null
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

function isSchemaDriftError(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('schema cache') || (normalized.includes('column') && normalized.includes('student_profiles'))
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ debug_match?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const authMetadata = (user?.user_metadata ?? {}) as {
    resume_path?: string
    resume_file_name?: string
  }
  const hasSavedResume = typeof authMetadata.resume_path === 'string' && authMetadata.resume_path.trim().length > 0
  const savedResumeFileName =
    typeof authMetadata.resume_file_name === 'string' && authMetadata.resume_file_name.trim().length > 0
      ? authMetadata.resume_file_name.trim()
      : null
  let userRole: 'student' | 'employer' | 'admin' | null = null

  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (userRow?.role === 'student' || userRow?.role === 'employer' || userRow?.role === 'admin') {
      userRole = userRow.role
    }
  }

  const detailResult = await getInternshipById(id, {
    viewerId: user?.id ?? null,
    viewerRole: userRole,
  })
  const listing = detailResult.listing as any

  let matchBreakdown:
    | {
        scorePercent: number
        categories: Array<{
          key: string
          label: string
          weightPoints: number
          achievedFraction: number
          earnedPoints: number
          summary: string
          reasons: Array<{ text: string; points: number }>
          gaps: Array<{ text: string }>
          status: 'good' | 'partial' | 'gap' | 'unknown'
          couldImprove?: string | null
          availabilityFit?: {
            hours_fit: { score: number; max: number; label: string }
            term_fit: { score: number; max: number; label: string }
            category_score: number
            status: 'good' | 'partial' | 'gap' | 'unknown'
          }
        }>
        signalContributions?: Array<{
          signalKey: string
          pointsAwarded: number
          rawMatchValue: number
          weight: number
          evidence: string[]
        }>
      }
    | null = null
  let profileCompletionPercent = 0
  let commuteMinutes: number | null = null
  let maxCommuteMinutes: number | null = null
  let employerAvatarUrl: string | null = null
  let requiredCustomSkillTokens = new Set<string>()
  let preferredCustomSkillTokens = new Set<string>()
  if (user && userRole === 'student' && listing) {
    const fullProfileSelect =
      'school, major_id, major:canonical_majors(id, slug, name), majors, year, experience_level, coursework, coursework_unverified, interests, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode, location_lat, location_lng'
    const fallbackProfileSelect =
      'school, major_id, major:canonical_majors(id, slug, name), majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, preferred_zip, max_commute_minutes, transport_mode'
    const profileResult = await supabase
      .from('student_profiles')
      .select(fullProfileSelect)
      .eq('user_id', user.id)
      .maybeSingle()
    const profile =
      profileResult.error && isSchemaDriftError(profileResult.error.message)
        ? (
            await supabase
              .from('student_profiles')
              .select(fallbackProfileSelect)
              .eq('user_id', user.id)
              .maybeSingle()
          ).data
        : profileResult.data
    const [{ data: studentProfileSkillRows }, { data: studentSkillRows }, courseworkFeatures] = await Promise.all([
      supabase
        .from('student_profile_skills')
        .select('canonical_skill_id, custom_skill_id, canonical_skill:skills(label), custom_skill:custom_skills(name)')
        .eq('student_id', user.id),
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

    const canonicalSkillIdsFromProfile = (studentProfileSkillRows ?? [])
      .map((row) => row.canonical_skill_id)
      .filter((value): value is string => typeof value === 'string')
    const canonicalSkillIdsFromLegacy = (studentSkillRows ?? [])
      .map((row) => row.skill_id)
      .filter((value): value is string => typeof value === 'string')
    const canonicalSkillLabelsFromProfile = (studentProfileSkillRows ?? [])
      .map((row) => {
        const skill = row.canonical_skill as { label?: string | null } | null
        return typeof skill?.label === 'string' ? skill.label : ''
      })
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    const customSkillLabels = (studentProfileSkillRows ?? [])
      .map((row) => {
        const custom = row.custom_skill as { name?: string | null } | null
        return typeof custom?.name === 'string' ? custom.name : ''
      })
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    const canonicalSkillLabelsFromLegacy = (studentSkillRows ?? [])
      .map((row) => {
        const skill = row.skill as { label?: string | null } | null
        return typeof skill?.label === 'string' ? skill.label : ''
      })
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    const canonicalSkillIds = canonicalSkillIdsFromProfile.length > 0 ? canonicalSkillIdsFromProfile : canonicalSkillIdsFromLegacy
    const canonicalSkillLabels =
      canonicalSkillLabelsFromProfile.length > 0 ? canonicalSkillLabelsFromProfile : canonicalSkillLabelsFromLegacy
    const canonicalCourseworkItemIds = courseworkFeatures.legacyItemIds
    const canonicalCourseworkCategoryIds = courseworkFeatures.legacyCategoryIds
    const coursework = courseworkFeatures.textCoursework
      ? courseworkFeatures.textCoursework
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : []
    const preferenceSignals = parseStudentPreferenceSignals(profile?.interests ?? null)
    const profilePreferredLocation = fallbackPreferredLocation(profile?.preferred_city, profile?.preferred_state)
    const preferredLocations =
      preferenceSignals.preferredLocations.length > 0
        ? preferenceSignals.preferredLocations
        : profilePreferredLocation
          ? [profilePreferredLocation]
          : []
    const combinedProfileSkills = Array.from(new Set([...preferenceSignals.skills, ...canonicalSkillLabels, ...customSkillLabels]))
    const profileCompleteness = await getStudentProfileCompleteness({
      supabase,
      userId: user.id,
      preloaded: {
        profile: profile ?? null,
        resumePath: typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path : null,
        skillsCount: combinedProfileSkills.length,
        courseworkFeatures: {
          courseCount: coursework.length,
          canonicalCategoryIds: courseworkFeatures.canonicalCategoryIds,
          textCoursework: courseworkFeatures.textCoursework,
          unverifiedText: courseworkFeatures.unverifiedText,
        },
      },
    })
    profileCompletionPercent = formatCompleteness(profileCompleteness.percent)
    const normalizedListingCoursework = normalizeListingCoursework({
      internship_required_course_categories: listing.internship_required_course_categories,
      internship_coursework_category_links: listing.internship_coursework_category_links,
      internship_coursework_items: listing.internship_coursework_items,
    })

    const listingRequiredCustomSkills = (listing.internship_skill_requirements ?? [])
      .filter((item: any) => item.importance === 'required' && typeof item.custom_skill_id === 'string')
      .map((item: any) => {
        const custom = item.custom_skill as { name?: string | null } | null
        return typeof custom?.name === 'string' ? custom.name : ''
      })
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    const listingPreferredCustomSkills = (listing.internship_skill_requirements ?? [])
      .filter((item: any) => item.importance === 'preferred' && typeof item.custom_skill_id === 'string')
      .map((item: any) => {
        const custom = item.custom_skill as { name?: string | null } | null
        return typeof custom?.name === 'string' ? custom.name : ''
      })
      .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
    requiredCustomSkillTokens = new Set(listingRequiredCustomSkills.map(normalizeSkillChipToken))
    preferredCustomSkillTokens = new Set(listingPreferredCustomSkills.map(normalizeSkillChipToken))

    const match = evaluateInternshipMatch(
      {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        majors: listing.majors,
        target_graduation_years: listing.target_graduation_years ?? null,
        experience_level: (listing as { target_student_year?: string | null }).target_student_year ?? listing.experience_level ?? null,
        target_student_year: (listing as { target_student_year?: string | null }).target_student_year ?? listing.experience_level ?? null,
        desired_coursework_strength: (listing as { desired_coursework_strength?: string | null }).desired_coursework_strength ?? null,
        hours_per_week: listing.hours_per_week,
        location: listing.location,
        category: listing.role_category ?? null,
        work_mode: listing.work_mode ?? null,
        term: listing.term ?? null,
        start_date: (listing as { start_date?: string | null }).start_date ?? null,
        application_deadline: listing.application_deadline ?? null,
        required_skills: listing.required_skills ?? null,
        preferred_skills: listing.preferred_skills ?? null,
        recommended_coursework: listing.recommended_coursework ?? null,
        required_course_category_ids: normalizedListingCoursework.requiredCanonicalCategoryIds,
        required_course_category_names: normalizedListingCoursework.requiredCanonicalCategoryNames,
        required_skill_ids: (listing.internship_required_skill_items ?? [])
          .map((item: any) => item.skill_id)
          .filter((value: any): value is string => typeof value === 'string'),
        preferred_skill_ids: (listing.internship_preferred_skill_items ?? [])
          .map((item: any) => item.skill_id)
          .filter((value: any): value is string => typeof value === 'string'),
        required_custom_skills: listingRequiredCustomSkills,
        preferred_custom_skills: listingPreferredCustomSkills,
        coursework_item_ids: (listing.internship_coursework_items ?? [])
          .map((item: any) => item.coursework_item_id)
          .filter((value: any): value is string => typeof value === 'string'),
        coursework_category_ids: (listing.internship_coursework_category_links ?? [])
          .map((item: any) => item.category_id)
          .filter((value: any): value is string => typeof value === 'string'),
        coursework_category_names: (listing.internship_coursework_category_links ?? [])
          .map((item: any) => {
            const category = item.category as { name?: string | null } | null
            return typeof category?.name === 'string' ? category.name : ''
          })
          .filter((value: any): value is string => typeof value === 'string' && value.length > 0),
      },
      {
        majors: (() => {
          const majorName = canonicalMajorName(profile?.major)
          return majorName ? parseMajors([majorName]) : parseMajors(profile?.majors ?? null)
        })(),
        year: profile?.year ?? null,
        experience_level: profile?.experience_level ?? null,
        skills: combinedProfileSkills,
        custom_skills: customSkillLabels,
        coursework,
        skill_ids: canonicalSkillIds,
        canonical_coursework_category_ids: courseworkFeatures.canonicalCategoryIds,
        canonical_coursework_category_names: courseworkFeatures.canonicalCategoryNames,
        canonical_coursework_level_bands: courseworkFeatures.canonicalCourseLevelBands,
        coursework_item_ids: canonicalCourseworkItemIds,
        coursework_category_ids: canonicalCourseworkCategoryIds,
        availability_hours_per_week: profile?.availability_hours_per_week ?? null,
        availability_start_month: profile?.availability_start_month ?? null,
        preferred_terms:
          preferenceSignals.preferredTerms.length > 0
            ? preferenceSignals.preferredTerms
            : profile?.availability_start_month
              ? (() => {
                  const season = normalizeSeason(profile.availability_start_month)
                  return season ? [season] : []
                })()
              : [],
        preferred_locations: preferredLocations,
        preferred_work_modes: preferenceSignals.preferredWorkModes,
        remote_only: preferenceSignals.remoteOnly,
      },
      undefined,
      { explain: true }
    )

    if (process.env.MATCHING_DEBUG_PIPELINE === '1') {
      console.info('[jobs:detail:matching-pipeline]', {
        listingId: listing.id,
        studentId: user.id,
        profileSkills: combinedProfileSkills,
        profileSkillIds: canonicalSkillIds,
        profileCourseworkCategories: courseworkFeatures.canonicalCategoryNames,
        profileCoursework: coursework,
        listingRequiredSkills: listing.required_skills ?? [],
        listingPreferredSkills: listing.preferred_skills ?? [],
        listingRequiredCourseworkCategories: normalizedListingCoursework.requiredCanonicalCategoryNames,
        matchScore: match.score,
        matchReasons: match.reasons,
        matchGaps: match.gaps,
      })
    }

    matchBreakdown = {
      scorePercent: typeof match.breakdown?.total_score === 'number' ? match.breakdown.total_score : match.score,
        categories: (match.breakdown?.categories ?? []).map((item) => ({
          key: item.key,
          label: item.label,
          weightPoints: item.weight_points,
          achievedFraction: item.achieved_fraction,
          earnedPoints: item.earned_points,
          summary: item.summary,
          reasons: item.reasons,
          gaps: item.gaps,
          status: item.status,
          couldImprove: item.could_improve ?? null,
          availabilityFit: item.availability_fit,
        })),
      signalContributions: match.breakdown?.perSignalContributions.map((item) => ({
        signalKey: item.signalKey,
        pointsAwarded: item.pointsAwarded,
        rawMatchValue: item.rawMatchValue,
        weight: item.weight,
        evidence: item.evidence,
      })),
    }

    maxCommuteMinutes = typeof profile?.max_commute_minutes === 'number' ? profile.max_commute_minutes : null
    const origin = {
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

    let fallbackEmployerLocation: {
      city: string | null
      state: string | null
      zip: string | null
      point: { lat: number; lng: number } | null
    } | null = null

    if (listing.employer_id) {
      const { data: employerProfile } = await supabase
        .from('employer_profiles')
        .select('location, location_lat, location_lng, avatar_url')
        .eq('user_id', listing.employer_id)
        .maybeSingle()
      if (employerProfile) {
        const parsed = parseCityState(employerProfile.location ?? null)
        employerAvatarUrl = typeof employerProfile.avatar_url === 'string' ? employerProfile.avatar_url : null
        fallbackEmployerLocation = {
          city: parsed.city,
          state: parsed.state,
          zip: null,
          point: toGeoPoint(
            typeof employerProfile.location_lat === 'number' ? employerProfile.location_lat : null,
            typeof employerProfile.location_lng === 'number' ? employerProfile.location_lng : null
          ),
        }
      }
    }

    const commuteMap = await getCommuteMinutesForListings({
      supabase,
      userId: user.id,
      origin,
      transportMode: typeof profile?.transport_mode === 'string' ? profile.transport_mode : 'driving',
      destinations: [
        {
          internshipId: listing.id,
          workMode: listing.work_mode,
          city: listing.location_city ?? null,
          state: listing.location_state ?? null,
          zip: null,
          point: toGeoPoint(
            typeof listing.location_lat === 'number' ? listing.location_lat : null,
            typeof listing.location_lng === 'number' ? listing.location_lng : null
          ),
          fallbackCity: fallbackEmployerLocation?.city ?? listing.location_city,
          fallbackState: fallbackEmployerLocation?.state ?? listing.location_state,
          fallbackZip: fallbackEmployerLocation?.zip ?? null,
          fallbackPoint: fallbackEmployerLocation?.point ?? null,
        },
      ],
      requirePrecisePoints: true,
    })

    commuteMinutes = commuteMap.get(listing.id) ?? null
  }

  if (!listing && detailResult.access === 'not_found') {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">
              This listing no longer exists or the link is incorrect.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!listing && detailResult.access === 'not_authorized') {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Not authorized / not published</h1>
            <p className="mt-2 text-sm text-slate-700">
              This listing exists, but it is not available for your account yet.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-semibold text-slate-900">Job not found</h1>
            <p className="mt-2 text-sm text-slate-600">This listing could not be loaded right now.</p>
          </div>
        </div>
      </main>
    )
  }

  const viewDay = new Date().toISOString().slice(0, 10)
  const viewDedupeKey = user?.id ? `view:${listing.id}:${user.id}:${viewDay}` : null
  const applicationCap = typeof listing.application_cap === 'number' ? listing.application_cap : 60
  const applicationsCount = typeof listing.applications_count === 'number' ? listing.applications_count : 0
  const capReached = applicationsCount >= applicationCap
  const { data: responseStatsRow } =
    listing.employer_id
      ? await supabase
          .from('employer_response_rate_stats')
          .select('applications_total, viewed_within_7d_rate')
          .eq('employer_id', listing.employer_id)
          .maybeSingle()
      : { data: null as { applications_total: number; viewed_within_7d_rate: number | null } | null }
  const employerApplicationsTotal =
    typeof responseStatsRow?.applications_total === 'number' ? responseStatsRow.applications_total : 0
  const employerResponseRate =
    typeof responseStatsRow?.viewed_within_7d_rate === 'number' ? responseStatsRow.viewed_within_7d_rate : null
  const scoreUi = scoreLabel(matchBreakdown?.scorePercent ?? null)
  const showMatchDebug = resolvedSearchParams?.debug_match === '1'
  const screeningQuestion = parseScreeningQuestion(listing.description)
  const structuredResponsibilities: string[] = Array.isArray(listing.responsibilities)
    ? listing.responsibilities.map((item: any) => String(item).trim()).filter(Boolean)
    : []
  const structuredQualifications: string[] = Array.isArray(listing.qualifications)
    ? listing.qualifications.map((item: any) => String(item).trim()).filter(Boolean)
    : []
  const parsedRoleOverviewBullets = parseDashedBullets(listing.description)
  const roleOverviewSummary = listing.short_summary?.trim() ?? ''
  const hasRoleOverviewContent =
    roleOverviewSummary.length > 0 ||
    structuredResponsibilities.length > 0 ||
    structuredQualifications.length > 0 ||
    parsedRoleOverviewBullets.length > 0 ||
    Boolean(listing.description?.trim())
  const scoreCircleClasses = getMatchScoreTone(matchBreakdown?.scorePercent ?? null)
  const scoreCircleValue = (matchBreakdown?.scorePercent ?? 0) <= 0
      ? 'Low'
      : String(Math.round(matchBreakdown?.scorePercent ?? 0))
  const reasonCategories = (matchBreakdown?.categories ?? []).filter(
    (category) => category.status === 'good' || category.status === 'partial'
  )
  const gapCategories = (matchBreakdown?.categories ?? []).filter((category) => category.status === 'gap')
  const rowTone = (status: 'good' | 'partial' | 'gap' | 'unknown') => {
    if (status === 'good') {
      return {
        card: 'border-l-2 border-l-emerald-500 border-slate-200 bg-white',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        label: 'Good',
      }
    }
    if (status === 'partial') {
      return {
        card: 'border-l-2 border-l-amber-500 border-slate-200 bg-white',
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        label: 'Partial',
      }
    }
    if (status === 'gap') {
      return {
        card: 'border-l-2 border-l-rose-500 border-slate-200 bg-white',
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        label: 'Gap',
      }
    }
    return {
      card: 'border-l-2 border-l-slate-300 border-slate-200 bg-white',
      badge: 'border-slate-200 bg-slate-100 text-slate-700',
      label: 'Unknown',
    }
  }
  const conciseLines = (category: (typeof reasonCategories)[number] | (typeof gapCategories)[number]) => {
    const normalizeLine = (value: string) =>
      value
        .replace(/\s*\(\+\d+(?:\.\d+)?\)\s*$/i, '')
        .replace(/^[^:]+:\s*/, '')
        .trim()
    if (category.status === 'gap') {
      return category.gaps.slice(0, 2).map((item) => normalizeLine(item.text)).filter(Boolean)
    }
    return category.reasons.slice(0, 2).map((item) => normalizeLine(item.text)).filter(Boolean)
  }
  const metadataParts = [
    listing.location || 'Location TBD',
    listing.work_mode || null,
    listing.term || null,
    typeof listing.hours_per_week === 'number' ? `${listing.hours_per_week} hrs/week` : null,
    formatTargetYear((listing as { target_student_year?: string | null }).target_student_year ?? listing.experience_level) || null,
  ].filter((value): value is string => Boolean(value))
  const compensationLine = formatCompensationLine(listing)
  const minimumQualifications = Array.isArray((listing as { requirements_details?: { minimum?: string[] } | null }).requirements_details?.minimum)
    ? ((listing as { requirements_details?: { minimum?: string[] } | null }).requirements_details?.minimum ?? [])
    : []
  const preferredQualifications = Array.isArray((listing as { requirements_details?: { preferred?: string[] } | null }).requirements_details?.preferred)
    ? ((listing as { requirements_details?: { preferred?: string[] } | null }).requirements_details?.preferred ?? [])
    : []
  const complianceDetails = ((listing as { compliance_details?: {
    eeoProvided?: boolean
    payTransparencyProvided?: boolean
    atWillProvided?: boolean
    accommodationsProvided?: boolean
    accommodationsEmail?: string | null
    text?: string | null
  } | null }).compliance_details) ?? null
  const companyInitial = (listing.company_name ?? 'C').trim().charAt(0).toUpperCase()
  const deadlineDate = listing.application_deadline ? new Date(listing.application_deadline) : null
  const nowMs = new Date().getTime()
  const daysToDeadline =
    deadlineDate && Number.isFinite(deadlineDate.getTime())
      ? Math.ceil((deadlineDate.getTime() - nowMs) / (1000 * 60 * 60 * 24))
      : null
  const deadlinePassed = typeof daysToDeadline === 'number' && daysToDeadline < 0
  const isDeadlineSoon = typeof daysToDeadline === 'number' && daysToDeadline >= 0 && daysToDeadline <= 14

  await trackAnalyticsEvent({
    eventName: 'view_job_detail',
    userId: user?.id ?? null,
    properties: { listing_id: listing.id, dedupe_key: viewDedupeKey },
  })

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          aria-label="Back to listings"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                    {employerAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={employerAvatarUrl} alt={`${listing.company_name ?? 'Company'} logo`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-600">{companyInitial}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{listing.title || 'Internship'}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      {listing.employer_id ? (
                        <Link
                          href={`/employers/${encodeURIComponent(listing.employer_id)}`}
                          className="font-medium text-slate-700 hover:text-blue-700 hover:underline"
                        >
                          {listing.company_name || 'Company'}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-700">{listing.company_name || 'Company'}</span>
                      )}
                      <EmployerVerificationBadge tier={listing.employer_verification_tier ?? 'free'} />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  {userRole === 'student' ? (
                    <div className="flex flex-col items-center gap-2">
                      <MatchScoreCircleButton value={scoreCircleValue} className={scoreCircleClasses} />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                {metadataParts.map((part, index) => (
                  <span key={`${part}:${index}`} className="inline-flex items-center gap-2">
                    {index > 0 ? <span className="text-slate-400">•</span> : null}
                    {part}
                  </span>
                ))}
                {isDeadlineSoon ? (
                  <span className="ml-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Deadline soon
                  </span>
                ) : null}
              </div>
              {listing.majors ? (
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Target majors:</span> {formatMajors(listing.majors)}
                </p>
              ) : null}
              {typeof commuteMinutes === 'number' ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Estimated commute:</span>{' '}
                  <span className={typeof maxCommuteMinutes === 'number' && commuteMinutes > maxCommuteMinutes ? 'text-amber-700' : 'text-slate-600'}>
                    ~{commuteMinutes} min
                  </span>
                </p>
              ) : null}
              {Array.isArray(listing.recommended_coursework) && listing.recommended_coursework.length > 0 ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Recommended coursework:</span> {listing.recommended_coursework.join(', ')}
                </p>
              ) : null}
              {compensationLine ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Compensation:</span> {compensationLine}
                </p>
              ) : null}
              {typeof (listing as { compensation_notes?: string | null }).compensation_notes === 'string' && (listing as { compensation_notes?: string | null }).compensation_notes?.trim() ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Comp notes:</span> {(listing as { compensation_notes?: string | null }).compensation_notes}
                </p>
              ) : null}
              {typeof (listing as { work_authorization_scope?: string | null }).work_authorization_scope === 'string' && (listing as { work_authorization_scope?: string | null }).work_authorization_scope?.trim() ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-700">Work authorization:</span> {(listing as { work_authorization_scope?: string | null }).work_authorization_scope}
                </p>
              ) : null}
            </section>

            <section id="match-details" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">{scoreUi.title}</h2>
              </div>
              {!user ? (
                <p className="mt-2 text-sm text-slate-600">Sign in to see your personalized match breakdown.</p>
              ) : userRole !== 'student' ? (
                <p className="mt-2 text-sm text-slate-600">Match breakdown is available for student accounts.</p>
              ) : !matchBreakdown ? (
                <p className="mt-2 text-sm text-slate-600">Match breakdown unavailable.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        <Star className="h-3.5 w-3.5" />
                        Reasons
                      </div>
                      {reasonCategories.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {reasonCategories.map((category) => {
                            const percent = category.weightPoints > 0 ? Math.round((category.earnedPoints / category.weightPoints) * 100) : 0
                            const tone = rowTone(category.status)
                            const lines = conciseLines(category)
                            return (
                            <li key={`reason:${category.key}`} className={`rounded-md border px-3 py-1.5 text-sm text-slate-900 ${tone.card}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                                <span>{category.label} - {Math.round(category.weightPoints)}%</span>
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}>
                                    {tone.label}
                                  </span>
                                  <span>{percent}% • {category.earnedPoints.toFixed(1)}/{category.weightPoints}</span>
                                </div>
                              </div>
                              {lines.length > 0 ? (
                                <div className="mt-1 space-y-0.5 text-xs text-slate-700">
                                  {lines.map((line) => (
                                    <p key={`${category.key}:${line}`}>{line}</p>
                                  ))}
                                </div>
                              ) : null}
                            </li>
                          )})}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No strong overlaps yet. Add skills/coursework to improve this score.</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Gaps
                      </div>
                      {gapCategories.length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {gapCategories.map((category) => {
                            const primaryGap = category.gaps[0]?.text ?? `${category.label} not enough data yet`
                            const cta = gapCta(primaryGap)
                            const percent = category.weightPoints > 0 ? Math.round((category.earnedPoints / category.weightPoints) * 100) : 0
                            const tone = rowTone(category.status)
                            const lines = conciseLines(category)
                            return (
                              <li key={`gap:${category.key}`} className={`rounded-md border px-3 py-1.5 text-sm ${tone.card}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-rose-900">
                                  <span>{category.label} - {Math.round(category.weightPoints)}%</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone.badge}`}>
                                      {tone.label}
                                    </span>
                                    <span>{percent}% • {category.earnedPoints.toFixed(1)}/{category.weightPoints}</span>
                                  </div>
                                </div>
                                {lines.length > 0 ? (
                                  <div className="mt-1 space-y-0.5 text-xs text-rose-900">
                                    {lines.map((line) => (
                                      <p key={`${category.key}:gap:${line}`}>{line}</p>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-rose-900">{primaryGap}</div>
                                )}
                                {cta ? <p className="mt-1 text-xs text-rose-800">Fix: {cta.label}.</p> : null}
                                {cta ? (
                                  <Link href={cta.href} className="mt-1 inline-flex text-xs font-medium text-blue-700 hover:underline">
                                    {cta.label}
                                  </Link>
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No major gaps detected.</p>
                      )}
                    </div>

                    {showMatchDebug && matchBreakdown.signalContributions && matchBreakdown.signalContributions.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                          <FileText className="h-3.5 w-3.5" />
                          Score factors (debug)
                        </div>
                        <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Signal</th>
                                <th className="px-3 py-2 text-left font-semibold">Points</th>
                                <th className="px-3 py-2 text-left font-semibold">Raw</th>
                                <th className="px-3 py-2 text-left font-semibold">Weight</th>
                                <th className="px-3 py-2 text-left font-semibold">Evidence</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                              {matchBreakdown.signalContributions
                                .slice()
                                .sort((a, b) => Math.abs(b.pointsAwarded) - Math.abs(a.pointsAwarded))
                                .map((item) => {
                                  const definition = MATCH_SIGNAL_DEFINITIONS[item.signalKey as keyof typeof MATCH_SIGNAL_DEFINITIONS]
                                  return (
                                    <tr key={item.signalKey}>
                                      <td className="px-3 py-2">{definition?.label ?? item.signalKey}</td>
                                      <td className={`px-3 py-2 font-semibold ${item.pointsAwarded < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {item.pointsAwarded > 0 ? '+' : ''}
                                        {item.pointsAwarded.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2">{item.rawMatchValue.toFixed(2)}</td>
                                      <td className="px-3 py-2">{item.weight.toFixed(2)}</td>
                                      <td className="px-3 py-2">{item.evidence.slice(0, 2).join(' | ') || 'n/a'}</td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Developer diagnostics enabled via <code>?debug_match=1</code>.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            {hasRoleOverviewContent ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Role overview</h2>
                {roleOverviewSummary ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{roleOverviewSummary}</p> : null}
                {structuredResponsibilities.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Responsibilities</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                      {structuredResponsibilities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {structuredQualifications.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qualifications</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                      {structuredQualifications.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {minimumQualifications.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Minimum qualifications</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                      {minimumQualifications.map((item) => (
                        <li key={`min-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {preferredQualifications.length > 0 ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Desired qualifications</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                      {preferredQualifications.map((item) => (
                        <li key={`pref-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {structuredResponsibilities.length === 0 && structuredQualifications.length === 0 && parsedRoleOverviewBullets.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    {parsedRoleOverviewBullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  structuredResponsibilities.length === 0 &&
                  structuredQualifications.length === 0 &&
                  roleOverviewSummary.length === 0 &&
                  listing.description ? (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{listing.description}</p>
                  ) : null
                )}
              </section>
            ) : null}

            {complianceDetails && (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Compliance & EEO</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {complianceDetails.eeoProvided ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">EEO statement</span> : null}
                  {complianceDetails.payTransparencyProvided ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Pay transparency</span> : null}
                  {complianceDetails.atWillProvided ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">At-will language</span> : null}
                  {complianceDetails.accommodationsProvided ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Accommodations</span> : null}
                </div>
                {complianceDetails.accommodationsEmail ? (
                  <p className="mt-2 text-sm text-slate-700">Accommodation contact: {complianceDetails.accommodationsEmail}</p>
                ) : null}
                {complianceDetails.text ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{complianceDetails.text}</p>
                ) : null}
              </section>
            )}

            {Array.isArray(listing.required_skills) && listing.required_skills.length > 0 ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Required skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.required_skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full border border-blue-300 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
                    >
                      {skill}
                      {requiredCustomSkillTokens.has(normalizeSkillChipToken(skill)) ? (
                        <span className="ml-1 rounded bg-blue-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-900">
                          Custom
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(listing.preferred_skills) && listing.preferred_skills.length > 0 ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Preferred skills</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.preferred_skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                    >
                      {skill}
                      {preferredCustomSkillTokens.has(normalizeSkillChipToken(skill)) ? (
                        <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
                          Custom
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Ready to apply?</h2>
              <p className="mt-1 text-sm text-slate-700">
                {listing.application_deadline
                  ? `Deadline: ${formatDate(listing.application_deadline) ?? listing.application_deadline}`
                  : 'Applications are currently open.'}
              </p>

              <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <Users className="h-3.5 w-3.5" />
                    Applicants
                  </span>
                  <span className="text-right text-sm font-semibold">{applicationsCount} / {applicationCap}</span>
                </div>
                <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                  <span className="text-slate-600">Company</span>
                  {listing.employer_id ? (
                    <Link href={`/employers/${encodeURIComponent(listing.employer_id)}`} className="text-right font-medium text-blue-800 hover:underline">
                      {listing.company_name || 'Company'}
                    </Link>
                  ) : (
                    <span className="text-right font-medium">{listing.company_name || 'Company'}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900">
                <div className="font-semibold">Transparent applications.</div>
                <p className="mt-1 text-slate-700">
                  We show applicant counts and when employers view your application - so you&apos;re not applying into a black hole.
                </p>
              </div>

              <div className="mt-3 inline-flex items-center gap-1 text-xs text-slate-700">
                <Star className="h-3.5 w-3.5" />
                {employerApplicationsTotal >= 5 && employerResponseRate !== null
                  ? `Responds to ${Math.round(employerResponseRate)}% within 7 days`
                  : 'Response rate will appear after initial applicant activity'}
              </div>

              <div className="mt-3">
                <ApplyModalLauncher
                listingId={listing.id}
                companyName={listing.company_name || 'this company'}
                isAuthenticated={Boolean(user)}
                userRole={userRole === 'admin' ? null : userRole}
                isClosed={capReached || deadlinePassed}
                screeningQuestion={screeningQuestion}
                hasSavedResume={hasSavedResume}
                savedResumeFileName={savedResumeFileName}
              />
              </div>
              {capReached ? (
                <p className="mt-2 text-xs text-slate-700">Applications closed ({applicationCap} applicants).</p>
              ) : deadlinePassed ? (
                <p className="mt-2 text-xs text-slate-700">Applications closed (deadline passed).</p>
              ) : null}
              {listing.apply_mode === 'ats_link' || listing.apply_mode === 'hybrid' ? (
                <p className="mt-2 inline-flex items-start gap-1 text-xs text-slate-700">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700" />
                  {(String((listing as { ats_stage_mode?: string | null }).ats_stage_mode ?? 'curated') === 'immediate')
                    ? 'You will quick apply here first, then complete the employer ATS application.'
                    : 'Quick apply first. If selected, you’ll receive an ATS invite to complete the employer’s official application.'}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
