export type WorkMode = 'remote' | 'hybrid' | 'in_person'

export type InternshipMatchInput = {
  id: string
  title?: string | null
  majors?: string[] | string | null
  target_graduation_years?: string[] | string | null
  hours_per_week?: number | null
  location?: string | null
  description?: string | null
  work_mode?: string | null
  term?: string | null
  start_date?: string | null
  application_deadline?: string | null
  created_at?: string | null
  experience_level?: string | null
  target_student_year?: string | null
  desired_coursework_strength?: string | null
  required_course_category_ids?: string[] | null
  category?: string | null
  required_skills?: string[] | string | null
  preferred_skills?: string[] | string | null
  recommended_coursework?: string[] | string | null
  required_skill_ids?: string[] | null
  preferred_skill_ids?: string[] | null
  coursework_item_ids?: string[] | null
  coursework_category_ids?: string[] | null
  coursework_category_names?: string[] | null
}

export type StudentMatchProfile = {
  majors: string[]
  year?: string | null
  experience_level?: string | null
  skills?: string[]
  skill_ids?: string[]
  coursework_item_ids?: string[]
  coursework_category_ids?: string[]
  coursework?: string[]
  availability_start_month?: string | null
  availability_hours_per_week?: number | null
  preferred_terms?: string[]
  preferred_locations?: string[]
  preferred_work_modes?: WorkMode[]
  remote_only?: boolean
  strict_preferences?: boolean
  strict_term_only?: boolean
}

export type MatchWeights = {
  skillsRequired: number
  majorCategoryAlignment: number
  courseworkAlignment: number
  skillsPreferred: number
  experienceAlignment: number
  availability: number
  startDateFit: number
  termAlignment: number
  preferenceAlignment: number
}

export const MATCH_SIGNAL_KEYS = [
  'skillsRequired',
  'majorCategoryAlignment',
  'courseworkAlignment',
  'skillsPreferred',
  'experienceAlignment',
  'availability',
  'startDateFit',
  'termAlignment',
  'preferenceAlignment',
] as const

export type MatchSignalKey = (typeof MATCH_SIGNAL_KEYS)[number]

export const MATCH_SIGNAL_DEFINITIONS: Record<MatchSignalKey, { label: string; description: string }> = {
  skillsRequired: {
    label: 'Required skills',
    description: 'Core required skills overlap (canonical IDs first, then text fallback).',
  },
  majorCategoryAlignment: {
    label: 'Major/category alignment',
    description: 'Student major alignment with internship majors or category text.',
  },
  courseworkAlignment: {
    label: 'Coursework alignment',
    description: 'Coursework category/item overlap (category IDs first, then item IDs, then text fallback).',
  },
  skillsPreferred: {
    label: 'Preferred skills',
    description: 'Optional preferred skills overlap (canonical IDs first, then text fallback).',
  },
  experienceAlignment: {
    label: 'Experience alignment',
    description: 'Experience level compatibility (hard filter when required level is set).',
  },
  availability: {
    label: 'Availability fit',
    description: 'Hours per week closeness to student availability.',
  },
  startDateFit: {
    label: 'Start date fit',
    description: 'Alignment between internship start date and student availability month.',
  },
  termAlignment: {
    label: 'Term alignment',
    description: 'Soft alignment between preferred terms and internship term.',
  },
  preferenceAlignment: {
    label: 'Preference alignment',
    description: 'Soft alignment between preferred location/work mode and internship setup.',
  },
}

export const DEFAULT_MATCHING_WEIGHTS: MatchWeights = {
  skillsRequired: 4,
  majorCategoryAlignment: 3,
  courseworkAlignment: 2,
  skillsPreferred: 2,
  experienceAlignment: 1.5,
  availability: 2,
  startDateFit: 1,
  termAlignment: 1,
  preferenceAlignment: 1,
}

export const MATCHING_VERSION = 'v1.2'

export type MatchReason = {
  reasonKey: string
  humanText: string
  evidence: string[]
}

export type MatchSignalContribution = {
  signalKey: MatchSignalKey
  weight: number
  rawMatchValue: number
  pointsAwarded: number
  evidence: string[]
}

export type InternshipMatchBreakdown = {
  totalScoreRaw: number
  maxScoreRaw: number
  normalizedScore: number
  score100: number
  perSignalContributions: MatchSignalContribution[]
  reasons: MatchReason[]
}

export type InternshipMatchResult = {
  internshipId: string
  score: number
  reasons: string[]
  gaps: string[]
  eligible: boolean
  matchingVersion: string
  maxScore: number
  normalizedScore: number
  breakdown?: InternshipMatchBreakdown
}

export type EvaluateMatchOptions = {
  explain?: boolean
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function parseMajors(value: string[] | string | null | undefined) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean)
  }

  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function parseList(value: string[] | string | null | undefined) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(String(item))).filter(Boolean)
  }

  return value
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

function parseWorkMode(value: string | null | undefined): WorkMode | null {
  if (!value) return null
  const normalized = normalizeText(value)

  if (normalized.includes('remote')) return 'remote'
  if (normalized.includes('hybrid')) return 'hybrid'
  if (
    normalized === 'in person' ||
    normalized === 'in_person' ||
    normalized.includes('on site') ||
    normalized.includes('onsite') ||
    normalized.includes('on-site')
  ) {
    return 'in_person'
  }

  return null
}

function deriveWorkMode(internship: InternshipMatchInput): WorkMode | null {
  const explicit = parseWorkMode(internship.work_mode)
  if (explicit) return explicit

  const location = internship.location ?? ''
  const modeMatch = location.match(/\(([^)]+)\)\s*$/)
  if (!modeMatch) return null

  return parseWorkMode(modeMatch[1])
}

function deriveTerm(internship: InternshipMatchInput) {
  if (internship.term && internship.term.trim().length > 0) {
    return normalizeText(internship.term)
  }

  const description = internship.description ?? ''
  const seasonLine = description.match(/^season:\s*(.+)$/im)
  if (!seasonLine) return ''

  return normalizeText(seasonLine[1])
}

function deriveLocationName(internship: InternshipMatchInput) {
  const location = internship.location ?? ''
  if (!location) return ''

  return normalizeText(location.replace(/\s*\([^)]*\)\s*$/, ''))
}

function seasonFromTerm(term: string) {
  if (!term) return ''
  if (term.includes('summer')) return 'summer'
  if (term.includes('fall')) return 'fall'
  if (term.includes('spring')) return 'spring'
  if (term.includes('winter')) return 'winter'
  if (term.includes('june') || term.includes('july') || term.includes('august') || term.includes('may')) return 'summer'
  if (term.includes('september') || term.includes('october') || term.includes('november')) return 'fall'
  if (term.includes('december') || term.includes('january') || term.includes('february')) return 'winter'
  if (term.includes('march') || term.includes('april')) return 'spring'
  return term
}

function inferSkills(internship: InternshipMatchInput) {
  const requiredIds = Array.from(new Set((internship.required_skill_ids ?? []).filter(Boolean)))
  const preferredIds = Array.from(new Set((internship.preferred_skill_ids ?? []).filter(Boolean)))
  const required = parseList(internship.required_skills)
  const preferred = parseList(internship.preferred_skills)

  const description = internship.description ?? ''
  const requiredMatch = description.match(/^required skills?:\s*(.+)$/im)
  const preferredMatch = description.match(/^preferred skills?:\s*(.+)$/im)

  const requiredFromDescription = requiredMatch ? parseList(requiredMatch[1]) : []
  const preferredFromDescription = preferredMatch ? parseList(preferredMatch[1]) : []

  return {
    requiredIds,
    preferredIds,
    required: [...new Set([...required, ...requiredFromDescription])],
    preferred: [...new Set([...preferred, ...preferredFromDescription])],
  }
}

function overlapCount(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0

  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item)).length
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return numerator / denominator
}

function describeReason(label: string, points: number, details: string) {
  return `${label}: ${details} (+${points.toFixed(1)})`
}

function mapGap(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeGradYearToken(value: string) {
  return normalizeText(value).replace(/\s+/g, '')
}

function parseInternshipExperienceLevel(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeText(value)
  if (normalized === 'any') return null
  if (normalized === 'freshman') return 0
  if (normalized === 'sophomore') return 1
  if (normalized === 'junior') return 2
  if (normalized === 'senior') return 3
  if (normalized === 'entry') return 0
  if (normalized === 'mid') return 2
  return null
}

function parseStudentExperienceLevel(value: string | null | undefined) {
  if (!value) return null
  const normalized = normalizeText(value)
  if (normalized === 'freshman') return 0
  if (normalized === 'sophomore') return 1
  if (normalized === 'junior') return 2
  if (normalized === 'senior') return 3
  if (normalized === 'none') return 0
  if (normalized === 'projects') return 1
  if (normalized === 'internship') return 2
  return null
}

function courseworkStrengthMinimumCount(value: string | null | undefined) {
  const normalized = normalizeText(value ?? '')
  if (normalized === 'high') return 5
  if (normalized === 'medium') return 3
  return 1
}

function parseDateOnly(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const parsed = new Date(`${normalized}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function currentOrNextYearAvailabilityStart(monthLabel: string | null | undefined, now = new Date()) {
  const normalized = normalizeText(monthLabel ?? '')
  if (!normalized) return null

  const monthIndex = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ].findIndex((month) => month.startsWith(normalized.slice(0, 3)))

  if (monthIndex < 0) return null

  const year = now.getUTCFullYear()
  const thisYearDate = new Date(Date.UTC(year, monthIndex, 1))
  const today = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()))
  if (thisYearDate.getTime() >= today.getTime()) return thisYearDate

  return new Date(Date.UTC(year + 1, monthIndex, 1))
}

function addDays(date: Date, days: number) {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function clamp01(value: number) {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

export function getMatchMaxScore(weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS) {
  return MATCH_SIGNAL_KEYS.reduce((sum, signalKey) => sum + Math.max(0, weights[signalKey]), 0)
}

function emptySignalContributions(weights: MatchWeights): Record<MatchSignalKey, MatchSignalContribution> {
  return {
    skillsRequired: {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    majorCategoryAlignment: {
      signalKey: 'majorCategoryAlignment',
      weight: weights.majorCategoryAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    courseworkAlignment: {
      signalKey: 'courseworkAlignment',
      weight: weights.courseworkAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    skillsPreferred: {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    experienceAlignment: {
      signalKey: 'experienceAlignment',
      weight: weights.experienceAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    availability: {
      signalKey: 'availability',
      weight: weights.availability,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    startDateFit: {
      signalKey: 'startDateFit',
      weight: weights.startDateFit,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    termAlignment: {
      signalKey: 'termAlignment',
      weight: weights.termAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
    preferenceAlignment: {
      signalKey: 'preferenceAlignment',
      weight: weights.preferenceAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: [],
    },
  }
}

function gapSeverity(gap: string) {
  const normalized = gap.toLowerCase()
  if (normalized.includes('missing required skills')) return 100
  if (normalized.includes('experience mismatch')) return 90
  if (normalized.includes('hours exceed availability')) return 80
  if (normalized.includes('start before')) return 70
  if (normalized.includes('term mismatch')) return 60
  if (normalized.includes('work mode mismatch') || normalized.includes('location mismatch') || normalized.includes('preference')) return 50
  if (normalized.includes('no major/category alignment')) return 40
  return 10
}

function finalizeMatchResult(params: {
  internshipId: string
  reasonsWithPoints: Array<{ text: string; points: number; reasonKey: string; evidence: string[] }>
  gaps: string[]
  eligible: boolean
  explain: boolean
  signalContributions: Record<MatchSignalKey, MatchSignalContribution>
  weights: MatchWeights
}) {
  const totalScoreRaw = MATCH_SIGNAL_KEYS.reduce((sum, signalKey) => sum + params.signalContributions[signalKey].pointsAwarded, 0)
  const maxScoreRaw = getMatchMaxScore(params.weights)
  const normalizedScore = maxScoreRaw > 0 ? clamp01(totalScoreRaw / maxScoreRaw) : 0

  const sortedReasons = [...params.reasonsWithPoints].sort((a, b) => b.points - a.points)
  const score100 = Math.max(0, Math.min(100, Math.round(normalizedScore * 100)))

  const dedupedGaps = Array.from(new Set(params.gaps.map(mapGap).filter(Boolean)))
    .sort((a, b) => gapSeverity(b) - gapSeverity(a))
    .slice(0, 2)

  const result: InternshipMatchResult = {
    internshipId: params.internshipId,
    score: score100,
    reasons: sortedReasons.slice(0, 3).map((reason) => reason.text),
    gaps: dedupedGaps,
    eligible: params.eligible,
    matchingVersion: MATCHING_VERSION,
    maxScore: 100,
    normalizedScore: Number(normalizedScore.toFixed(4)),
  }

  if (params.explain) {
    const breakdownReasons: MatchReason[] = sortedReasons.slice(0, 3).map((reason) => ({
      reasonKey: reason.reasonKey,
      humanText: reason.text,
      evidence: reason.evidence,
    }))

    result.breakdown = {
      totalScoreRaw: Number(totalScoreRaw.toFixed(3)),
      maxScoreRaw: Number(maxScoreRaw.toFixed(3)),
      normalizedScore: Number(normalizedScore.toFixed(4)),
      score100,
      perSignalContributions: MATCH_SIGNAL_KEYS.map((signalKey) => ({
        ...params.signalContributions[signalKey],
        pointsAwarded: Number(params.signalContributions[signalKey].pointsAwarded.toFixed(3)),
        rawMatchValue: Number(params.signalContributions[signalKey].rawMatchValue.toFixed(4)),
      })),
      reasons: breakdownReasons,
    }
  }

  return result
}

export function evaluateInternshipMatch(
  internship: InternshipMatchInput,
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS,
  options: EvaluateMatchOptions = {}
): InternshipMatchResult {
  const explain = options.explain === true
  const reasonsWithPoints: Array<{ text: string; points: number; reasonKey: string; evidence: string[] }> = []
  const gaps: string[] = []
  const signalContributions = emptySignalContributions(weights)

  const workMode = deriveWorkMode(internship)
  const term = deriveTerm(internship)
  const locationName = deriveLocationName(internship)

  const preferredModes = profile.preferred_work_modes ?? []
  const preferredTerms = (profile.preferred_terms ?? []).map((value) => seasonFromTerm(normalizeText(value))).filter(Boolean)
  const preferredLocations = (profile.preferred_locations ?? []).map(normalizeText).filter(Boolean)

  const internshipIsInPerson = workMode === 'in_person' || workMode === 'hybrid'

  const deadlineDate = parseDateOnly(internship.application_deadline)
  if (deadlineDate) {
    const now = new Date()
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    if (deadlineDate.getTime() < today.getTime()) {
      gaps.push('Application deadline has passed.')
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }
  }

  if (profile.remote_only && workMode !== 'remote') {
    gaps.push('Requires in-person or hybrid work but your profile is remote-only.')
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  if (
    typeof internship.hours_per_week === 'number' &&
    typeof profile.availability_hours_per_week === 'number' &&
    internship.hours_per_week > profile.availability_hours_per_week
  ) {
    gaps.push(`Hours exceed availability (${internship.hours_per_week} > ${profile.availability_hours_per_week} hrs/week).`)
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  const strictPreferences = profile.strict_preferences === true
  const strictTermOnly = profile.strict_term_only === true

  if (strictPreferences && preferredModes.length > 0 && workMode && !preferredModes.includes(workMode)) {
    gaps.push(`Work mode mismatch (${workMode}).`)
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
    })
  }

  if (strictPreferences && internshipIsInPerson && preferredLocations.length > 0 && locationName) {
    const matchesPreferredLocation = preferredLocations.some(
      (preferred) => locationName.includes(preferred) || preferred.includes(locationName)
    )
    if (!matchesPreferredLocation) {
      gaps.push(`In-person location mismatch (${locationName}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }
  }

  if (strictTermOnly && preferredTerms.length > 0 && term) {
    const internshipSeason = seasonFromTerm(term)
    if (!preferredTerms.includes(internshipSeason)) {
      gaps.push(`Term mismatch (${term}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }
  }

  const studentMajors = profile.majors.map(normalizeText).filter(Boolean)
  const studentYear = normalizeGradYearToken(profile.year ?? '')
  const studentExperienceLevel = parseStudentExperienceLevel(profile.experience_level)
  const internshipMajors = parseMajors(internship.majors)
  const targetGradYears = parseList(internship.target_graduation_years).map(normalizeGradYearToken)
  const internshipExperienceLevel = parseInternshipExperienceLevel(
    internship.target_student_year ?? internship.experience_level
  )
  const internshipCategory = internship.category ? normalizeText(internship.category) : internshipMajors[0] ?? ''

  const studentSkills = [
    ...(profile.skills ?? []),
    ...(profile.coursework ?? []),
    ...studentMajors,
  ]
    .map(normalizeText)
    .filter(Boolean)
  const studentSkillIds = Array.from(new Set((profile.skill_ids ?? []).filter(Boolean)))
  const studentCourseworkIds = Array.from(new Set((profile.coursework_item_ids ?? []).filter(Boolean)))
  const studentCourseworkCategoryIds = Array.from(new Set((profile.coursework_category_ids ?? []).filter(Boolean)))

  const { requiredIds, preferredIds, required, preferred } = inferSkills(internship)

  if (requiredIds.length > 0 && studentSkillIds.length > 0) {
    const requiredHits = overlapCount(requiredIds, studentSkillIds)
    const requiredRatio = ratio(requiredHits, requiredIds.length)
    const points = weights.skillsRequired * requiredRatio
    signalContributions.skillsRequired = {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: requiredRatio,
      pointsAwarded: points,
      evidence: [`${requiredHits}/${requiredIds.length} canonical required skill IDs matched`],
    }

    if (requiredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.required.canonical_overlap',
        text: describeReason('Required skills', points, `${requiredHits}/${requiredIds.length} matched`),
        points,
        evidence: [`matched=${requiredHits}`, `required=${requiredIds.length}`],
      })
    }

    const missingRequiredCount = Math.max(0, requiredIds.length - requiredHits)
    if (missingRequiredCount > 0) {
      gaps.push(`Missing required skills: ${missingRequiredCount} canonical skill(s)`)
    }
  } else if (required.length > 0) {
    const requiredHits = overlapCount(required, studentSkills)
    const requiredRatio = ratio(requiredHits, required.length)
    const points = weights.skillsRequired * requiredRatio
    signalContributions.skillsRequired = {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: requiredRatio,
      pointsAwarded: points,
      evidence: [`${requiredHits}/${required.length} required skill tokens matched`],
    }

    if (requiredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.required.text_overlap',
        text: describeReason('Required skills', points, `${requiredHits}/${required.length} matched`),
        points,
        evidence: [`matched=${requiredHits}`, `required=${required.length}`],
      })
    }

    const missingRequired = required.filter((skill) => !studentSkills.includes(skill))
    if (missingRequired.length > 0) {
      gaps.push(`Missing required skills: ${missingRequired.join(', ')}`)
    }
  }

  if (preferredIds.length > 0 && studentSkillIds.length > 0) {
    const preferredHits = overlapCount(preferredIds, studentSkillIds)
    const preferredRatio = ratio(preferredHits, preferredIds.length)
    const points = weights.skillsPreferred * preferredRatio
    signalContributions.skillsPreferred = {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: preferredRatio,
      pointsAwarded: points,
      evidence: [`${preferredHits}/${preferredIds.length} canonical preferred skill IDs matched`],
    }

    if (preferredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.preferred.canonical_overlap',
        text: describeReason('Preferred skills', points, `${preferredHits}/${preferredIds.length} matched`),
        points,
        evidence: [`matched=${preferredHits}`, `preferred=${preferredIds.length}`],
      })
    }
  } else if (preferred.length > 0) {
    const preferredHits = overlapCount(preferred, studentSkills)
    const preferredRatio = ratio(preferredHits, preferred.length)
    const points = weights.skillsPreferred * preferredRatio
    signalContributions.skillsPreferred = {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: preferredRatio,
      pointsAwarded: points,
      evidence: [`${preferredHits}/${preferred.length} preferred skill tokens matched`],
    }

    if (preferredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.preferred.text_overlap',
        text: describeReason('Preferred skills', points, `${preferredHits}/${preferred.length} matched`),
        points,
        evidence: [`matched=${preferredHits}`, `preferred=${preferred.length}`],
      })
    }
  }

  const recommendedCourseworkCategoryIds = Array.from(
    new Set([...(internship.required_course_category_ids ?? []), ...(internship.coursework_category_ids ?? [])].filter(Boolean))
  )
  const recommendedCourseworkCategoryNames = Array.from(new Set(parseList(internship.coursework_category_names)))

  if (recommendedCourseworkCategoryIds.length > 0 && studentCourseworkCategoryIds.length > 0) {
    const categoryHits = overlapCount(recommendedCourseworkCategoryIds, studentCourseworkCategoryIds)
    const requiredHitsByStrength = courseworkStrengthMinimumCount(internship.desired_coursework_strength)
    const strengthRatio = ratio(Math.min(categoryHits, requiredHitsByStrength), requiredHitsByStrength)
    const categoryRatio = ratio(categoryHits, recommendedCourseworkCategoryIds.length)
    const points = weights.courseworkAlignment * Math.max(categoryRatio, strengthRatio)
    signalContributions.courseworkAlignment = {
      signalKey: 'courseworkAlignment',
      weight: weights.courseworkAlignment,
      rawMatchValue: categoryRatio,
      pointsAwarded: points,
      evidence: [
        `${categoryHits}/${recommendedCourseworkCategoryIds.length} coursework categories matched`,
        `strength=${internship.desired_coursework_strength ?? 'low'}`,
      ],
    }

    if (categoryHits > 0) {
      const categoryDetail =
        recommendedCourseworkCategoryNames.length > 0
          ? recommendedCourseworkCategoryNames.slice(0, categoryHits).join(', ')
          : `${categoryHits}/${recommendedCourseworkCategoryIds.length} category matches (${internship.desired_coursework_strength ?? 'low'} strength)`
      reasonsWithPoints.push({
        reasonKey: 'coursework.categories.canonical_overlap',
        text: describeReason('Coursework categories', points, categoryDetail),
        points,
        evidence: recommendedCourseworkCategoryNames.slice(0, categoryHits),
      })
    }
  } else {
    const recommendedCourseworkIds = Array.from(new Set((internship.coursework_item_ids ?? []).filter(Boolean)))
    if (recommendedCourseworkIds.length > 0 && studentCourseworkIds.length > 0) {
      const courseworkHits = overlapCount(recommendedCourseworkIds, studentCourseworkIds)
      const courseworkRatio = ratio(courseworkHits, recommendedCourseworkIds.length)
      const points = weights.courseworkAlignment * courseworkRatio
      signalContributions.courseworkAlignment = {
        signalKey: 'courseworkAlignment',
        weight: weights.courseworkAlignment,
        rawMatchValue: courseworkRatio,
        pointsAwarded: points,
        evidence: [`${courseworkHits}/${recommendedCourseworkIds.length} coursework items matched`],
      }

      if (courseworkHits > 0) {
        reasonsWithPoints.push({
          reasonKey: 'coursework.items.canonical_overlap',
          text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCourseworkIds.length} matched`),
          points,
          evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCourseworkIds.length}`],
        })
      }
    } else {
      const recommendedCoursework = parseList(internship.recommended_coursework)
      const studentCoursework = parseList(profile.coursework)
      if (recommendedCoursework.length > 0 && studentCoursework.length > 0) {
        const courseworkHits = overlapCount(recommendedCoursework, studentCoursework)
        const courseworkRatio = ratio(courseworkHits, recommendedCoursework.length)
        const points = weights.courseworkAlignment * courseworkRatio
        signalContributions.courseworkAlignment = {
          signalKey: 'courseworkAlignment',
          weight: weights.courseworkAlignment,
          rawMatchValue: courseworkRatio,
          pointsAwarded: points,
          evidence: [`${courseworkHits}/${recommendedCoursework.length} coursework text tokens matched`],
        }

        if (courseworkHits > 0) {
          reasonsWithPoints.push({
            reasonKey: 'coursework.text_overlap',
            text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCoursework.length} matched`),
            points,
            evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCoursework.length}`],
          })
        }
      }
    }
  }

  if (targetGradYears.length > 0 && studentYear) {
    const yearMatch = targetGradYears.includes(studentYear)
    if (!yearMatch) {
      gaps.push(`Graduation year mismatch (${profile.year ?? 'unknown'}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }
  }

  if (internshipExperienceLevel !== null && studentExperienceLevel !== null) {
    const passes = studentExperienceLevel >= internshipExperienceLevel
    signalContributions.experienceAlignment = {
      signalKey: 'experienceAlignment',
      weight: weights.experienceAlignment,
      rawMatchValue: passes ? 1 : 0,
      pointsAwarded: passes ? weights.experienceAlignment : 0,
      evidence: [
        `student_level=${profile.experience_level ?? 'unknown'}`,
        `required_level=${internship.experience_level ?? 'unknown'}`,
      ],
    }

    if (!passes) {
      gaps.push(`Experience mismatch (requires ${internship.experience_level}, profile is ${profile.experience_level ?? 'unknown'}).`)
      return finalizeMatchResult({
        internshipId: internship.id,
        reasonsWithPoints,
        gaps,
        eligible: false,
        explain,
        signalContributions,
        weights,
      })
    }

    reasonsWithPoints.push({
      reasonKey: 'experience.fit',
      text: describeReason('Experience alignment', weights.experienceAlignment, profile.experience_level ?? 'aligned'),
      points: weights.experienceAlignment,
      evidence: [`student_level=${profile.experience_level ?? 'unknown'}`],
    })
  }

  if (studentMajors.length > 0) {
    const majorHits = overlapCount(internshipMajors, studentMajors)
    const categoryHit = internshipCategory && studentMajors.some((major) => internshipCategory.includes(major))
    const alignmentRatio = majorHits > 0 ? ratio(majorHits, Math.max(1, internshipMajors.length)) : categoryHit ? 0.5 : 0
    const points = weights.majorCategoryAlignment * alignmentRatio
    signalContributions.majorCategoryAlignment = {
      signalKey: 'majorCategoryAlignment',
      weight: weights.majorCategoryAlignment,
      rawMatchValue: alignmentRatio,
      pointsAwarded: points,
      evidence:
        majorHits > 0
          ? [`major_hits=${majorHits}/${Math.max(1, internshipMajors.length)}`]
          : categoryHit
            ? [`category_hit=${internshipCategory}`]
            : [],
    }

    if (points > 0) {
      reasonsWithPoints.push({
        reasonKey: majorHits > 0 ? 'major.overlap' : 'major.category_fallback',
        text: describeReason(
          'Major/category alignment',
          points,
          majorHits > 0 ? `${majorHits} major overlap` : `category match (${internshipCategory})`
        ),
        points,
        evidence: majorHits > 0 ? [`major_hits=${majorHits}`] : [`category=${internshipCategory}`],
      })
    } else {
      gaps.push('No major/category alignment')
    }
  }

  if (
    typeof internship.hours_per_week === 'number' &&
    typeof profile.availability_hours_per_week === 'number'
  ) {
    const diff = Math.abs(internship.hours_per_week - profile.availability_hours_per_week)
    const closeness = Math.max(0, 1 - diff / Math.max(1, profile.availability_hours_per_week))
    const points = weights.availability * closeness
    signalContributions.availability = {
      signalKey: 'availability',
      weight: weights.availability,
      rawMatchValue: closeness,
      pointsAwarded: points,
      evidence: [`hours_diff=${diff}`, `student_hours=${profile.availability_hours_per_week}`],
    }

    if (points > 0) {
      reasonsWithPoints.push({
        reasonKey: 'availability.fit',
        text: describeReason('Availability fit', points, `${internship.hours_per_week} hrs/week`),
        points,
        evidence: [`internship_hours=${internship.hours_per_week}`],
      })
    }
  }

  const internshipSeason = seasonFromTerm(term)
  if (preferredTerms.length > 0 && internshipSeason) {
    const termAligned = preferredTerms.includes(internshipSeason)
    const rawValue = termAligned ? 1 : -1
    const points = weights.termAlignment * rawValue
    signalContributions.termAlignment = {
      signalKey: 'termAlignment',
      weight: weights.termAlignment,
      rawMatchValue: rawValue,
      pointsAwarded: points,
      evidence: [`preferred_terms=${preferredTerms.join('|')}`, `internship_term=${internshipSeason}`],
    }

    if (termAligned) {
      reasonsWithPoints.push({
        reasonKey: 'term.aligned',
        text: describeReason('Term alignment', points, internshipSeason),
        points,
        evidence: [`internship_term=${internshipSeason}`],
      })
    } else {
      gaps.push(`Term mismatch (${internshipSeason}).`)
    }
  }

  let hasComparablePreference = false
  let hasPreferenceMismatch = false
  let hasPreferenceAlignment = false

  if (preferredModes.length > 0 && workMode) {
    hasComparablePreference = true
    if (preferredModes.includes(workMode)) {
      hasPreferenceAlignment = true
    } else {
      hasPreferenceMismatch = true
      gaps.push(`Work mode mismatch (${workMode}).`)
    }
  }

  if (preferredLocations.length > 0 && internshipIsInPerson && locationName) {
    hasComparablePreference = true
    const matchesPreferredLocation = preferredLocations.some(
      (preferred) => locationName.includes(preferred) || preferred.includes(locationName)
    )
    if (matchesPreferredLocation) {
      hasPreferenceAlignment = true
    } else {
      hasPreferenceMismatch = true
      gaps.push(`In-person location mismatch (${locationName}).`)
    }
  }

  if (hasComparablePreference) {
    const rawValue = hasPreferenceMismatch ? -1 : hasPreferenceAlignment ? 1 : 0
    const points = weights.preferenceAlignment * rawValue
    signalContributions.preferenceAlignment = {
      signalKey: 'preferenceAlignment',
      weight: weights.preferenceAlignment,
      rawMatchValue: rawValue,
      pointsAwarded: points,
      evidence: [`work_mode=${workMode ?? 'unknown'}`, `location=${locationName || 'unknown'}`],
    }

    if (rawValue > 0) {
      reasonsWithPoints.push({
        reasonKey: 'preferences.aligned',
        text: describeReason('Preference alignment', points, 'work mode/location match'),
        points,
        evidence: [`work_mode=${workMode ?? 'unknown'}`, `location=${locationName || 'unknown'}`],
      })
    }
  }

  const internshipStartDate = parseDateOnly(internship.start_date)
  const availabilityStartDate = currentOrNextYearAvailabilityStart(profile.availability_start_month)
  if (internshipStartDate && availabilityStartDate) {
    const threshold = addDays(availabilityStartDate, -14)
    let rawValue = 0
    if (internshipStartDate.getTime() < threshold.getTime()) rawValue = -1
    else if (internshipStartDate.getTime() >= availabilityStartDate.getTime()) rawValue = 1

    const points = weights.startDateFit * rawValue
    signalContributions.startDateFit = {
      signalKey: 'startDateFit',
      weight: weights.startDateFit,
      rawMatchValue: rawValue,
      pointsAwarded: points,
      evidence: [
        `internship_start=${internship.start_date ?? ''}`,
        `availability_start=${availabilityStartDate.toISOString().slice(0, 10)}`,
      ],
    }

    if (rawValue > 0) {
      reasonsWithPoints.push({
        reasonKey: 'start_date.after_availability',
        text: describeReason('Start date fit', points, "Starts after your availability"),
        points,
        evidence: [`internship_start=${internship.start_date ?? ''}`],
      })
    } else if (rawValue < 0) {
      gaps.push("May start before you're available")
    }
  }

  return finalizeMatchResult({
    internshipId: internship.id,
    reasonsWithPoints,
    gaps,
    eligible: true,
    explain,
    signalContributions,
    weights,
  })
}

export function rankInternships(
  internships: InternshipMatchInput[],
  profile: StudentMatchProfile,
  weights: MatchWeights = DEFAULT_MATCHING_WEIGHTS,
  options: EvaluateMatchOptions = {}
) {
  return internships
    .map((internship) => ({
      internship,
      match: evaluateInternshipMatch(internship, profile, weights, options),
    }))
    .filter((item) => item.match.eligible)
    .sort((left, right) => {
      if (right.match.score !== left.match.score) return right.match.score - left.match.score
      const leftCreatedAt = new Date((left.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      const rightCreatedAt = new Date((right.internship as { created_at?: string | null }).created_at ?? 0).getTime()
      if (rightCreatedAt !== leftCreatedAt) return rightCreatedAt - leftCreatedAt
      return String(left.internship.id).localeCompare(String(right.internship.id))
    })
}
