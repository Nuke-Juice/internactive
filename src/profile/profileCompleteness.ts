export const PROFILE_FULL_MATCHING_THRESHOLD = 70

export type ProfileCompletenessInput = {
  major_id?: string | null
  majors?: string[] | string | null
  interests?: string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | string | null
  preferred_city?: string | null
  preferred_state?: string | null
  max_commute_minutes?: number | null
}

export type ProfileCompletenessFeatures = {
  resumeUploaded?: boolean
  courseworkCount?: number
  derivedCourseworkCategoryCount?: number
  skillsCount?: number
}

export type ProfileCompletenessKey =
  | 'resume'
  | 'major'
  | 'coursework'
  | 'skills'
  | 'availability_start_month'
  | 'availability_hours_per_week'
  | 'location_preferences'

export type MissingItem = {
  key: ProfileCompletenessKey
  label: string
  isComplete: boolean
  weight: number
  ctaHref?: string
  details?: string
}

export type ProfileCompletenessResult = {
  percent: number
  missing: string[]
  isReadyForFullMatching: boolean
}

export type CanonicalProfileCompletenessResult = {
  percent: number
  missing: MissingItem[]
  nextAction?: MissingItem
  breakdown: {
    resumeUploaded: boolean
    hasMajor: boolean
    hasCoursework: boolean
    hasSkills: boolean
    hasStartMonth: boolean
    hasHours: boolean
    hasLocation: boolean
    courseworkCount: number
    derivedCourseworkCategoryCount: number
    skillsCount: number
  }
  isReadyForFullMatching: boolean
}

const WEIGHTS = {
  resume: 20,
  major: 15,
  coursework: 20,
  skills: 15,
  startMonth: 10,
  hoursPerWeek: 10,
  location: 10,
} as const

function parseMajors(value: ProfileCompletenessInput['majors']) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function parseHours(value: ProfileCompletenessInput['availability_hours_per_week']) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function formatCompleteness(percent: number) {
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(100, Math.round(percent)))
}

export function computeProfileCompleteness(
  profile: ProfileCompletenessInput | null | undefined,
  features: ProfileCompletenessFeatures = {}
): CanonicalProfileCompletenessResult {
  const majors = parseMajors(profile?.majors)
  const hasMajor = Boolean((profile?.major_id ?? '').trim()) || majors.length > 0 || Boolean(profile?.interests?.trim())
  const hasResume = features.resumeUploaded === true
  const courseworkCount = features.courseworkCount ?? 0
  const derivedCourseworkCategoryCount = features.derivedCourseworkCategoryCount ?? 0
  const hasCoursework = courseworkCount >= 1 || derivedCourseworkCategoryCount >= 1
  const skillsCount = features.skillsCount ?? 0
  const hasSkills = skillsCount >= 1
  const hasStartMonth = Boolean(profile?.availability_start_month?.trim())
  const hasHours = parseHours(profile?.availability_hours_per_week) > 0
  const hasLocation = Boolean(
    profile?.preferred_city?.trim() || profile?.preferred_state?.trim() || (profile?.max_commute_minutes ?? 0) > 0
  )

  const items: MissingItem[] = [
    {
      key: 'resume',
      label: 'Resume upload',
      isComplete: hasResume,
      weight: WEIGHTS.resume,
      ctaHref: '/account#resume',
      details: hasResume ? undefined : 'Upload a resume PDF to improve ranking.',
    },
    {
      key: 'major',
      label: 'Major or interest area',
      isComplete: hasMajor,
      weight: WEIGHTS.major,
      ctaHref: '/account#major',
    },
    {
      key: 'coursework',
      label: 'Coursework categories',
      isComplete: hasCoursework,
      weight: WEIGHTS.coursework,
      ctaHref: '/account#coursework',
      details: 'Derived from your entered courses.',
    },
    {
      key: 'skills',
      label: 'Skills',
      isComplete: hasSkills,
      weight: WEIGHTS.skills,
      ctaHref: '/account#skills',
    },
    {
      key: 'availability_start_month',
      label: 'Availability start month',
      isComplete: hasStartMonth,
      weight: WEIGHTS.startMonth,
      ctaHref: '/account#availability',
    },
    {
      key: 'availability_hours_per_week',
      label: 'Availability hours per week',
      isComplete: hasHours,
      weight: WEIGHTS.hoursPerWeek,
      ctaHref: '/account#availability',
    },
    {
      key: 'location_preferences',
      label: 'Location preferences',
      isComplete: hasLocation,
      weight: WEIGHTS.location,
      ctaHref: '/account#preferences',
    },
  ]

  const points = items.reduce((sum, item) => sum + (item.isComplete ? item.weight : 0), 0)
  const percent = formatCompleteness(points)
  const missing = items.filter((item) => !item.isComplete)
  const nextAction = missing.slice().sort((a, b) => b.weight - a.weight)[0]

  return {
    percent,
    missing,
    nextAction,
    breakdown: {
      resumeUploaded: hasResume,
      hasMajor,
      hasCoursework,
      hasSkills,
      hasStartMonth,
      hasHours,
      hasLocation,
      courseworkCount,
      derivedCourseworkCategoryCount,
      skillsCount,
    },
    isReadyForFullMatching: percent >= PROFILE_FULL_MATCHING_THRESHOLD,
  }
}

export function getProfileCompleteness(
  profile: ProfileCompletenessInput | null | undefined,
  features: ProfileCompletenessFeatures = {}
): ProfileCompletenessResult {
  const canonical = computeProfileCompleteness(profile, features)
  return {
    percent: canonical.percent,
    missing: canonical.missing.map((item) => item.label),
    isReadyForFullMatching: canonical.isReadyForFullMatching,
  }
}

export function isFixableMatchGaps(gaps: string[]) {
  const normalized = gaps.map((gap) => gap.toLowerCase())
  if (normalized.length === 0) return false

  const hardBlockers = [
    'application deadline has passed',
    'requires in-person or hybrid work but your profile is remote-only',
    'experience mismatch',
    'graduation year mismatch',
    'in-person location mismatch',
  ]
  if (normalized.some((gap) => hardBlockers.some((blocker) => gap.includes(blocker)))) {
    return false
  }

  const fixableHints = [
    'add courses',
    'add skills',
    'add your earliest start month',
    'add weekly hours',
    'missing required skills',
    'missing required coursework categories',
    'late start',
    'availability',
  ]
  return normalized.some((gap) => fixableHints.some((hint) => gap.includes(hint)))
}
