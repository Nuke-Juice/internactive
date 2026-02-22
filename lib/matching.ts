import { normalizeSkillForMatching, normalizeSkillListForMatching } from './skills/normalizeForMatching.ts'
import {
  formatSeasonsList,
  normalizeListingSeasons,
  normalizePreferredSeasons,
} from '@/lib/availability/normalizeSeason'
import { seasonOverlap } from '@/lib/availability/seasonOverlap'

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
  required_course_category_names?: string[] | null
  category?: string | null
  required_skills?: string[] | string | null
  preferred_skills?: string[] | string | null
  recommended_coursework?: string[] | string | null
  required_skill_ids?: string[] | null
  preferred_skill_ids?: string[] | null
  required_custom_skills?: string[] | null
  preferred_custom_skills?: string[] | null
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
  custom_skills?: string[]
  canonical_coursework_category_ids?: string[]
  canonical_coursework_category_names?: string[]
  canonical_coursework_level_bands?: string[]
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
    description: 'Combined start-timing and hours fit, weighted toward start timing.',
  },
  startDateFit: {
    label: 'Start date fit',
    description: 'Start timing diagnostics (earliest student start month vs listing start month).',
  },
  termAlignment: {
    label: 'Term alignment',
    description: 'Fallback season alignment when exact start month is unavailable.',
  },
  preferenceAlignment: {
    label: 'Preference alignment',
    description: 'Soft alignment between preferred location/work mode and internship setup.',
  },
}

export const DEFAULT_MATCHING_WEIGHTS: MatchWeights = {
  skillsRequired: 4,
  majorCategoryAlignment: 3,
  courseworkAlignment: 2.5,
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

export type MatchCategoryKey = 'skills' | 'coursework' | 'major' | 'availability' | 'location'

export type AvailabilityFitBreakdown = {
  hours_fit: { score: number; max: number; label: string }
  term_fit: { score: number; max: number; label: string }
  category_score: number
  status: 'good' | 'partial' | 'gap' | 'unknown'
}

export type MatchCategoryBreakdownItem = {
  key: MatchCategoryKey
  label: string
  weight_points: number
  achieved_fraction: number
  earned_points: number
  summary: string
  reasons: Array<{ text: string; points: number }>
  gaps: Array<{ text: string }>
  status: 'good' | 'partial' | 'gap' | 'unknown'
  could_improve?: string | null
  availability_fit?: AvailabilityFitBreakdown
}

export type InternshipMatchBreakdown = {
  total_score: number
  totalScoreRaw: number
  maxScoreRaw: number
  normalizedScore: number
  score100: number
  perSignalContributions: MatchSignalContribution[]
  reasons: MatchReason[]
  categories: MatchCategoryBreakdownItem[]
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
  courseworkSignalPathUsed?: 'canonical' | 'legacy' | 'text' | 'none'
  breakdown?: InternshipMatchBreakdown
}

export type EvaluateMatchOptions = {
  explain?: boolean
}

type ReasonWithPoints = {
  text: string
  points: number
  reasonKey: string
  evidence: string[]
}

const MATCH_CATEGORY_WEIGHTS: Record<MatchCategoryKey, number> = {
  skills: 25,
  coursework: 25,
  major: 20,
  availability: 15,
  location: 15,
}

const MATCH_CATEGORY_DEFINITIONS: Record<
  MatchCategoryKey,
  { label: string; signalWeights: Array<{ key: MatchSignalKey; weight: number }> }
> = {
  skills: {
    label: 'Skills',
    signalWeights: [
      { key: 'skillsRequired', weight: 4 },
      { key: 'skillsPreferred', weight: 2 },
    ],
  },
  coursework: {
    label: 'Coursework',
    signalWeights: [{ key: 'courseworkAlignment', weight: 1 }],
  },
  major: {
    label: 'Major/category alignment',
    signalWeights: [{ key: 'majorCategoryAlignment', weight: 3 }],
  },
  availability: {
    label: 'Availability',
    signalWeights: [{ key: 'availability', weight: 1 }],
  },
  location: {
    label: 'Location/work mode fit',
    signalWeights: [{ key: 'preferenceAlignment', weight: 1 }],
  },
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

const MONTH_LABELS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

function monthIndexFromLabel(value: string | null | undefined) {
  const normalized = normalizeText(value ?? '')
  if (!normalized) return -1
  return MONTH_LABELS.findIndex((month) => month.startsWith(normalized.slice(0, 3)))
}

function monthNameFromIndex(monthIndex: number | null) {
  if (monthIndex === null || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return 'unknown'
  const value = MONTH_LABELS[monthIndex]
  return `${value[0].toUpperCase()}${value.slice(1)}`
}

function parseStartMonthIndexFromTerm(term: string | null | undefined) {
  const normalized = normalizeText(term ?? '')
  if (!normalized) return null
  const match = normalized.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)/
  )
  if (match) {
    const month = monthIndexFromLabel(match[1])
    return month >= 0 ? month : null
  }
  if (normalized.includes('spring')) return 2
  if (normalized.includes('summer')) return 4
  if (normalized.includes('fall') || normalized.includes('autumn')) return 8
  if (normalized.includes('winter')) return 0
  return null
}

function parseStartMonthIndexFromStartDate(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
  const monthIndex = Number(normalized.slice(5, 7)) - 1
  return Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11 ? monthIndex : null
}

function fallbackStartMonthFromPreferredTerms(preferredTerms: string[]) {
  const monthIndexes: number[] = []
  for (const term of preferredTerms) {
    const value = normalizeText(term)
    if (value.includes('spring')) monthIndexes.push(2)
    else if (value.includes('summer')) monthIndexes.push(4)
    else if (value.includes('fall') || value.includes('autumn')) monthIndexes.push(8)
    else if (value.includes('winter')) monthIndexes.push(0)
  }
  if (monthIndexes.length === 0) return null
  return Math.min(...monthIndexes)
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

function inferSkills(internship: InternshipMatchInput) {
  const requiredIds = Array.from(new Set((internship.required_skill_ids ?? []).filter(Boolean)))
  const preferredIds = Array.from(new Set((internship.preferred_skill_ids ?? []).filter(Boolean)))
  const requiredCustom = normalizeSkillListForMatching(parseList(internship.required_custom_skills))
  const preferredCustom = normalizeSkillListForMatching(parseList(internship.preferred_custom_skills))
  const required = normalizeSkillListForMatching(parseList(internship.required_skills))
  const preferred = normalizeSkillListForMatching(parseList(internship.preferred_skills))

  const description = internship.description ?? ''
  const requiredMatch = description.match(/^required skills?:\s*(.+)$/im)
  const preferredMatch = description.match(/^preferred skills?:\s*(.+)$/im)

  const requiredFromDescription = requiredMatch ? normalizeSkillListForMatching(parseList(requiredMatch[1])) : []
  const preferredFromDescription = preferredMatch ? normalizeSkillListForMatching(parseList(preferredMatch[1])) : []

  const requiredCustomSet = new Set(requiredCustom)
  const preferredCustomSet = new Set(preferredCustom)

  return {
    requiredIds,
    preferredIds,
    requiredCustom,
    preferredCustom,
    required: [...new Set([...required, ...requiredFromDescription])].filter((token) => !requiredCustomSet.has(token)),
    preferred: [...new Set([...preferred, ...preferredFromDescription])].filter((token) => !preferredCustomSet.has(token)),
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

function formatHours(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'unknown'
  return `${Math.round(value)} hrs/week`
}

function availabilityStatusFromFraction(fraction: number, hasHoursData: boolean, hasTermData: boolean): AvailabilityFitBreakdown['status'] {
  if (!hasHoursData && !hasTermData) return 'unknown'
  if (fraction >= 0.85) return 'good'
  if (fraction > 0.1) return 'partial'
  return 'gap'
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
  if (normalized.includes('required coursework categories')) return 85
  if (normalized.includes('experience mismatch')) return 90
  if (normalized.includes('expects about') || normalized.includes('availability')) return 80
  if (normalized.includes('late start')) return 80
  if (normalized.includes('start before')) return 70
  if (normalized.includes('term mismatch')) return 60
  if (normalized.includes('work mode mismatch') || normalized.includes('location mismatch') || normalized.includes('preference')) return 50
  if (normalized.includes('no major/category alignment')) return 40
  return 10
}

function normalizeSignalFraction(raw: number) {
  if (!Number.isFinite(raw)) return 0
  if (raw <= 0) return 0
  if (raw >= 1) return 1
  return raw
}

function mapReasonKeyToCategory(reasonKey: string): MatchCategoryKey {
  if (reasonKey.startsWith('skills.')) return 'skills'
  if (reasonKey.startsWith('coursework.')) return 'coursework'
  if (reasonKey.startsWith('major.')) return 'major'
  if (reasonKey.startsWith('availability.') || reasonKey.startsWith('term.') || reasonKey.startsWith('start_date.')) return 'availability'
  if (reasonKey.startsWith('preferences.')) return 'location'
  if (reasonKey.startsWith('experience.')) return 'major'
  return 'skills'
}

function mapGapToCategory(gap: string): MatchCategoryKey {
  const normalized = gap.toLowerCase()
  if (normalized.includes('coursework')) return 'coursework'
  if (normalized.includes('major')) return 'major'
  if (normalized.includes('work mode') || normalized.includes('location mismatch') || normalized.includes('remote-only')) return 'location'
  if (normalized.includes('hours') || normalized.includes('term mismatch') || normalized.includes('start')) return 'availability'
  if (normalized.includes('skills')) return 'skills'
  if (normalized.includes('experience')) return 'major'
  return 'skills'
}

function hasEvidenceFlag(contribution: MatchSignalContribution, flag: string) {
  return contribution.evidence.some((entry) => entry === flag)
}

function humanSummaryFromSignals(params: {
  key: MatchCategoryKey
  contributions: Record<MatchSignalKey, MatchSignalContribution>
  reasons: Array<{ text: string; points: number }>
  gaps: Array<{ text: string }>
}) {
  const { key, contributions, reasons, gaps } = params
  if (key === 'skills') {
    if (reasons.length > 0) return 'Your listed skills align with this role.'
    return gaps.length > 0 ? 'Some required skills are still missing.' : 'Add skills to improve this match.'
  }
  if (key === 'coursework') {
    if (hasEvidenceFlag(contributions.courseworkAlignment, 'student_coursework_missing')) {
      return 'Add courses to improve this match.'
    }
    if (reasons.length > 0) return 'Coursework categories inferred from your courses align with this role.'
    return gaps.length > 0 ? 'Coursework preferences are only partially aligned.' : 'No coursework requirement detected.'
  }
  if (key === 'major') {
    if (reasons.length > 0) return 'Your major aligns with the role targets.'
    return gaps.length > 0 ? 'Major alignment could be improved.' : 'Add major details to improve this match.'
  }
  if (key === 'availability') {
    if (reasons.length > 0) return 'Your time availability aligns with this listing.'
    return gaps.length > 0 ? 'Availability alignment could be improved.' : 'Add availability details to improve this match.'
  }
  if (reasons.length > 0) return 'Your location/work mode preferences are aligned.'
  return gaps.length > 0
    ? 'Location or work mode preferences may not align.'
    : 'Add location/work mode preferences to improve this match.'
}

function categorySummaryFromSignals(params: {
  key: MatchCategoryKey
  contributions: Record<MatchSignalKey, MatchSignalContribution>
  reasons: Array<{ text: string; points: number }>
  gaps: Array<{ text: string }>
}) {
  return humanSummaryFromSignals(params)
}

function effectiveSignalWeightsForCategory(params: {
  key: MatchCategoryKey
  signalContributions: Record<MatchSignalKey, MatchSignalContribution>
}) {
  const { key, signalContributions } = params
  const definition = MATCH_CATEGORY_DEFINITIONS[key]
  if (key !== 'skills') return definition.signalWeights

  const hasPreferredSignal =
    signalContributions.skillsPreferred.evidence.length > 0 || signalContributions.skillsPreferred.pointsAwarded !== 0
  if (!hasPreferredSignal) {
    return definition.signalWeights.filter((item) => item.key !== 'skillsPreferred')
  }
  return definition.signalWeights
}

function buildCategoryBreakdown(params: {
  signalContributions: Record<MatchSignalKey, MatchSignalContribution>
  reasonsWithPoints: ReasonWithPoints[]
  gaps: string[]
  availabilityFit: AvailabilityFitBreakdown
}) {
  const categoryReasons = new Map<MatchCategoryKey, Array<{ text: string; points: number }>>()
  for (const reason of params.reasonsWithPoints) {
    const category = mapReasonKeyToCategory(reason.reasonKey)
    const existing = categoryReasons.get(category) ?? []
    existing.push({ text: reason.text.replace(/\s*\(\+\d+(\.\d+)?\)\s*$/i, ''), points: Number(reason.points.toFixed(1)) })
    categoryReasons.set(category, existing)
  }

  const categoryGaps = new Map<MatchCategoryKey, Array<{ text: string }>>()
  for (const gap of params.gaps) {
    const category = mapGapToCategory(gap)
    const existing = categoryGaps.get(category) ?? []
    existing.push({ text: gap })
    categoryGaps.set(category, existing)
  }

  const categories: MatchCategoryBreakdownItem[] = (Object.keys(MATCH_CATEGORY_DEFINITIONS) as MatchCategoryKey[]).map((key) => {
    const definition = MATCH_CATEGORY_DEFINITIONS[key]
    const effectiveSignalWeights = effectiveSignalWeightsForCategory({
      key,
      signalContributions: params.signalContributions,
    })
    const weightedRaw = effectiveSignalWeights.reduce((sum, item) => {
      const contribution = params.signalContributions[item.key]
      return sum + normalizeSignalFraction(contribution.rawMatchValue) * item.weight
    }, 0)
    const weightTotal = effectiveSignalWeights.reduce((sum, item) => sum + item.weight, 0)
    const achievedFraction = weightTotal > 0 ? clamp01(weightedRaw / weightTotal) : 0
    const weightPoints = MATCH_CATEGORY_WEIGHTS[key]
    const earnedPoints = Number((weightPoints * achievedFraction).toFixed(1))
    const reasons = (categoryReasons.get(key) ?? []).sort((a, b) => b.points - a.points).slice(0, 3)
    const gaps = (categoryGaps.get(key) ?? []).slice(0, 3)
    const hasEvidence = effectiveSignalWeights.some((item) => {
      const row = params.signalContributions[item.key]
      return row.evidence.length > 0 || row.pointsAwarded !== 0
    })
    let status: MatchCategoryBreakdownItem['status'] = 'unknown'
    if (key === 'availability') {
      status = params.availabilityFit.status
    } else if (key === 'coursework' && hasEvidenceFlag(params.signalContributions.courseworkAlignment, 'student_coursework_missing')) {
      status = 'unknown'
    } else if (!hasEvidence && reasons.length === 0 && gaps.length === 0) {
      status = 'unknown'
    } else if (gaps.length > 0 && reasons.length === 0 && achievedFraction <= 0.1) {
      status = 'gap'
    } else if (gaps.length > 0) {
      status = 'partial'
    } else if (achievedFraction >= 0.85) {
      status = 'good'
    } else if (achievedFraction > 0.1 || reasons.length > 0) {
      status = 'partial'
    }

    const couldImprove = status === 'partial' ? gaps[0]?.text ?? null : null

    return {
      key,
      label: definition.label,
      weight_points: weightPoints,
      achieved_fraction: Number(achievedFraction.toFixed(4)),
      earned_points: earnedPoints,
      summary: categorySummaryFromSignals({ key, contributions: params.signalContributions, reasons, gaps }),
      reasons,
      gaps,
      status,
      could_improve: couldImprove,
      availability_fit: key === 'availability' ? params.availabilityFit : undefined,
    }
  })

  const adjustedTotal = Number(categories.reduce((sum, category) => sum + category.earned_points, 0).toFixed(1))
  return {
    categories,
    totalScore: adjustedTotal,
  }
}

function finalizeMatchResult(params: {
  internshipId: string
  reasonsWithPoints: ReasonWithPoints[]
  gaps: string[]
  eligible: boolean
  explain: boolean
  signalContributions: Record<MatchSignalKey, MatchSignalContribution>
  weights: MatchWeights
  courseworkSignalPathUsed?: 'canonical' | 'legacy' | 'text' | 'none'
  availabilityFit: AvailabilityFitBreakdown
}) {
  const totalScoreRaw = MATCH_SIGNAL_KEYS.reduce((sum, signalKey) => sum + params.signalContributions[signalKey].pointsAwarded, 0)
  const maxScoreRaw = getMatchMaxScore(params.weights)

  const sortedReasons = [...params.reasonsWithPoints].sort((a, b) => b.points - a.points)
  const categoryBreakdown = buildCategoryBreakdown({
    signalContributions: params.signalContributions,
    reasonsWithPoints: params.reasonsWithPoints,
    gaps: params.gaps,
    availabilityFit: params.availabilityFit,
  })
  const score100 = Math.max(0, Math.min(100, Math.round(categoryBreakdown.totalScore)))
  const normalizedScore = Number((score100 / 100).toFixed(4))

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
    normalizedScore,
    courseworkSignalPathUsed: params.courseworkSignalPathUsed ?? 'none',
  }

  if (params.explain) {
    const breakdownReasons: MatchReason[] = sortedReasons.slice(0, 3).map((reason) => ({
      reasonKey: reason.reasonKey,
      humanText: reason.text,
      evidence: reason.evidence,
    }))

    result.breakdown = {
      total_score: Number(categoryBreakdown.totalScore.toFixed(1)),
      totalScoreRaw: Number(totalScoreRaw.toFixed(3)),
      maxScoreRaw: Number(maxScoreRaw.toFixed(3)),
      normalizedScore,
      score100,
      perSignalContributions: MATCH_SIGNAL_KEYS.map((signalKey) => ({
        ...params.signalContributions[signalKey],
        pointsAwarded: Number(params.signalContributions[signalKey].pointsAwarded.toFixed(3)),
        rawMatchValue: Number(params.signalContributions[signalKey].rawMatchValue.toFixed(4)),
      })),
      reasons: breakdownReasons,
      categories: categoryBreakdown.categories,
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
  const availabilityFit: AvailabilityFitBreakdown = {
    hours_fit: { score: 0, max: 6, label: 'Hours not provided yet' },
    term_fit: { score: 0, max: 9, label: 'Start month not provided yet' },
    category_score: 0,
    status: 'unknown',
  }

  const workMode = deriveWorkMode(internship)
  const term = deriveTerm(internship)
  const locationName = deriveLocationName(internship)

  const preferredModes = profile.preferred_work_modes ?? []
  const preferredTerms = normalizePreferredSeasons({
    preferredTerms: profile.preferred_terms ?? [],
    availabilityStartMonth: profile.availability_start_month ?? null,
  })
  const listingSeasons = normalizeListingSeasons({
    term,
    startDate: internship.start_date ?? null,
  })
  const explicitStudentStartMonthIndex = monthIndexFromLabel(profile.availability_start_month ?? null)
  const fallbackStudentStartMonthIndex = fallbackStartMonthFromPreferredTerms(profile.preferred_terms ?? [])
  const studentStartMonthIndex =
    explicitStudentStartMonthIndex >= 0 ? explicitStudentStartMonthIndex : fallbackStudentStartMonthIndex
  const studentStartMonthSource =
    explicitStudentStartMonthIndex >= 0
      ? 'start_month'
      : fallbackStudentStartMonthIndex !== null
        ? 'season_fallback'
        : 'missing'
  const listingStartMonthIndex =
    parseStartMonthIndexFromStartDate(internship.start_date ?? null) ?? parseStartMonthIndexFromTerm(term)
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
        availabilityFit,
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
      availabilityFit,
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
      availabilityFit,
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
        availabilityFit,
      })
    }
  }

  if (strictTermOnly && studentStartMonthIndex !== null && listingStartMonthIndex !== null && studentStartMonthIndex > listingStartMonthIndex) {
    gaps.push(
      `Late start: role begins in ${monthNameFromIndex(listingStartMonthIndex)}, your earliest start is ${monthNameFromIndex(studentStartMonthIndex)}.`
    )
    return finalizeMatchResult({
      internshipId: internship.id,
      reasonsWithPoints,
      gaps,
      eligible: false,
      explain,
      signalContributions,
      weights,
      availabilityFit,
    })
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

  const studentSkills = normalizeSkillListForMatching([
    ...(profile.skills ?? []),
    ...(profile.custom_skills ?? []),
    ...(profile.coursework ?? []),
    ...studentMajors,
  ])
  const studentSkillIds = Array.from(new Set((profile.skill_ids ?? []).filter(Boolean)))
  const studentCanonicalCourseworkCategoryIds = Array.from(new Set((profile.canonical_coursework_category_ids ?? []).filter(Boolean)))
  const studentCanonicalCourseworkCategoryNames = Array.from(new Set(parseList(profile.canonical_coursework_category_names)))
  const studentCanonicalCourseworkLevelBands = Array.from(new Set(parseList(profile.canonical_coursework_level_bands)))
  const studentCourseworkIds = Array.from(new Set((profile.coursework_item_ids ?? []).filter(Boolean)))
  const studentCourseworkCategoryIds = Array.from(new Set((profile.coursework_category_ids ?? []).filter(Boolean)))
  const studentCoursework = parseList(profile.coursework)

  const { requiredIds, preferredIds, required, preferred, requiredCustom, preferredCustom } = inferSkills(internship)

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

    const studentSkillSet = new Set(studentSkills.map((skill) => normalizeSkillForMatching(skill)))
    const missingRequired = required.filter((skill) => !studentSkillSet.has(normalizeSkillForMatching(skill)))
    if (missingRequired.length > 0) {
      gaps.push(`Missing required skills: ${missingRequired.join(', ')}`)
    }
  }
  if (requiredCustom.length > 0) {
    const customRequiredHits = overlapCount(requiredCustom, studentSkills)
    const customRequiredRatio = ratio(customRequiredHits, requiredCustom.length)
    const customRequiredCap = weights.skillsRequired * 0.2
    const customRequiredPoints = customRequiredCap * customRequiredRatio
    const currentRequiredPoints = signalContributions.skillsRequired.pointsAwarded
    const mergedRequiredPoints = Math.min(weights.skillsRequired, currentRequiredPoints + customRequiredPoints)
    const mergedRequiredRaw = weights.skillsRequired > 0 ? mergedRequiredPoints / weights.skillsRequired : 0
    const currentRequiredEvidence = signalContributions.skillsRequired.evidence

    signalContributions.skillsRequired = {
      signalKey: 'skillsRequired',
      weight: weights.skillsRequired,
      rawMatchValue: mergedRequiredRaw,
      pointsAwarded: mergedRequiredPoints,
      evidence: [
        ...currentRequiredEvidence,
        `${customRequiredHits}/${requiredCustom.length} custom required skill tokens matched`,
      ],
    }

    if (customRequiredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.required.custom_overlap',
        text: describeReason('Required skills', customRequiredPoints, `${customRequiredHits}/${requiredCustom.length} custom matched`),
        points: customRequiredPoints,
        evidence: [`matched=${customRequiredHits}`, `required_custom=${requiredCustom.length}`],
      })
    }
    if (customRequiredHits < requiredCustom.length) {
      const studentSkillSet = new Set(studentSkills.map((skill) => normalizeSkillForMatching(skill)))
      const missingRequiredCustom = requiredCustom.filter((skill) => !studentSkillSet.has(normalizeSkillForMatching(skill)))
      if (missingRequiredCustom.length > 0) {
        gaps.push(`Missing required skills: ${missingRequiredCustom.slice(0, 4).join(', ')}`)
      }
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
    if (preferredHits < preferredIds.length) {
      gaps.push(`Preferred skills: ${preferredHits}/${preferredIds.length} matched.`)
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
    if (preferredHits < preferred.length) {
      gaps.push(`Preferred skills: ${preferredHits}/${preferred.length} matched.`)
    }
  }
  if (preferredCustom.length > 0) {
    const customPreferredHits = overlapCount(preferredCustom, studentSkills)
    const customPreferredRatio = ratio(customPreferredHits, preferredCustom.length)
    const customPreferredCap = weights.skillsPreferred * 0.2
    const customPreferredPoints = customPreferredCap * customPreferredRatio
    const currentPreferredPoints = signalContributions.skillsPreferred.pointsAwarded
    const mergedPreferredPoints = Math.min(weights.skillsPreferred, currentPreferredPoints + customPreferredPoints)
    const mergedPreferredRaw = weights.skillsPreferred > 0 ? mergedPreferredPoints / weights.skillsPreferred : 0
    const currentPreferredEvidence = signalContributions.skillsPreferred.evidence
    signalContributions.skillsPreferred = {
      signalKey: 'skillsPreferred',
      weight: weights.skillsPreferred,
      rawMatchValue: mergedPreferredRaw,
      pointsAwarded: mergedPreferredPoints,
      evidence: [
        ...currentPreferredEvidence,
        `${customPreferredHits}/${preferredCustom.length} custom preferred skill tokens matched`,
      ],
    }
    if (customPreferredHits > 0) {
      reasonsWithPoints.push({
        reasonKey: 'skills.preferred.custom_overlap',
        text: describeReason('Preferred skills', customPreferredPoints, `${customPreferredHits}/${preferredCustom.length} custom matched`),
        points: customPreferredPoints,
        evidence: [`matched=${customPreferredHits}`, `preferred_custom=${preferredCustom.length}`],
      })
    }
  }

  let courseworkSignalPathUsed: 'canonical' | 'legacy' | 'text' | 'none' = 'none'
  const requiredCanonicalCourseworkCategoryIds = Array.from(new Set((internship.required_course_category_ids ?? []).filter(Boolean)))
  const requiredCanonicalCourseworkCategoryNames = Array.from(new Set(parseList(internship.required_course_category_names)))
  const recommendedCourseworkCategoryIds = Array.from(new Set((internship.coursework_category_ids ?? []).filter(Boolean)))
  const recommendedCourseworkCategoryNames = Array.from(new Set(parseList(internship.coursework_category_names)))

  if (requiredCanonicalCourseworkCategoryIds.length > 0) {
    courseworkSignalPathUsed = 'canonical'
    const categoryHits = overlapCount(requiredCanonicalCourseworkCategoryIds, studentCanonicalCourseworkCategoryIds)
    const requiredHitsByStrength = courseworkStrengthMinimumCount(internship.desired_coursework_strength)
    const strengthRatio = ratio(Math.min(categoryHits, requiredHitsByStrength), requiredHitsByStrength)
    const categoryRatio = ratio(categoryHits, requiredCanonicalCourseworkCategoryIds.length)
    const hasStudentCourseworkSignals =
      studentCanonicalCourseworkCategoryIds.length > 0 ||
      studentCourseworkCategoryIds.length > 0 ||
      studentCourseworkIds.length > 0 ||
      studentCoursework.length > 0
    const hasAdvancedSignals = studentCanonicalCourseworkLevelBands.some((band) => band === 'advanced')
    const listingWantsAdvancedSignal =
      normalizeText(internship.desired_coursework_strength ?? '') === 'high' ||
      normalizeText(internship.target_student_year ?? internship.experience_level ?? '') === 'senior'
    const levelBonus = hasAdvancedSignals && listingWantsAdvancedSignal ? 0.12 : 0
    const neutralMissingCourseworkRaw = 0.45
    const adjustedRaw = hasStudentCourseworkSignals
      ? clamp01(Math.max(categoryRatio, strengthRatio) + levelBonus)
      : neutralMissingCourseworkRaw
    const points = weights.courseworkAlignment * adjustedRaw
    signalContributions.courseworkAlignment = {
      signalKey: 'courseworkAlignment',
      weight: weights.courseworkAlignment,
      rawMatchValue: adjustedRaw,
      pointsAwarded: points,
      evidence: [
        `${categoryHits}/${requiredCanonicalCourseworkCategoryIds.length} required coursework categories matched`,
        hasStudentCourseworkSignals ? 'student_coursework_present' : 'student_coursework_missing',
      ],
    }

    if (!hasStudentCourseworkSignals) {
      gaps.push('Add courses to improve matching for this role.')
    }

    const missingRequiredCanonicalNames = requiredCanonicalCourseworkCategoryNames.filter(
      (name) => !studentCanonicalCourseworkCategoryNames.includes(name)
    )
    if (hasStudentCourseworkSignals && missingRequiredCanonicalNames.length > 0) {
      gaps.push(`Missing required coursework categories: ${missingRequiredCanonicalNames.slice(0, 3).join(', ')}`)
    }

    if (categoryHits > 0) {
      const categoryDetail =
        requiredCanonicalCourseworkCategoryNames.length > 0
          ? requiredCanonicalCourseworkCategoryNames
              .filter((name) => studentCanonicalCourseworkCategoryNames.includes(name))
              .slice(0, 3)
              .join(', ')
          : `${categoryHits}/${requiredCanonicalCourseworkCategoryIds.length} canonical matches`
      reasonsWithPoints.push({
        reasonKey: 'coursework.required_categories.canonical_overlap',
        text: describeReason('Coursework fit', points, `inferred categories match (${categoryDetail})`),
        points,
        evidence: requiredCanonicalCourseworkCategoryNames.slice(0, 3),
      })
    }
  } else if (recommendedCourseworkCategoryIds.length > 0 && studentCourseworkCategoryIds.length > 0) {
    courseworkSignalPathUsed = 'legacy'
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
        `${categoryHits}/${recommendedCourseworkCategoryIds.length} legacy coursework categories matched`,
        `strength=${internship.desired_coursework_strength ?? 'low'}`,
      ],
    }

      if (categoryHits > 0) {
      const categoryDetail =
        recommendedCourseworkCategoryNames.length > 0
          ? recommendedCourseworkCategoryNames.slice(0, categoryHits).join(', ')
          : `${categoryHits}/${recommendedCourseworkCategoryIds.length} category matches (${internship.desired_coursework_strength ?? 'low'} strength)`
      reasonsWithPoints.push({
        reasonKey: 'coursework.categories.legacy_overlap',
        text: describeReason('Coursework fit', points, `inferred categories match (${categoryDetail})`),
        points,
        evidence: recommendedCourseworkCategoryNames.slice(0, categoryHits),
      })
    }
  } else {
    const recommendedCourseworkIds = Array.from(new Set((internship.coursework_item_ids ?? []).filter(Boolean)))
    if (recommendedCourseworkIds.length > 0 && studentCourseworkIds.length > 0) {
      courseworkSignalPathUsed = 'legacy'
      const courseworkHits = overlapCount(recommendedCourseworkIds, studentCourseworkIds)
      const courseworkRatio = ratio(courseworkHits, recommendedCourseworkIds.length)
      const points = weights.courseworkAlignment * courseworkRatio
      signalContributions.courseworkAlignment = {
        signalKey: 'courseworkAlignment',
        weight: weights.courseworkAlignment,
        rawMatchValue: courseworkRatio,
        pointsAwarded: points,
        evidence: [`${courseworkHits}/${recommendedCourseworkIds.length} legacy coursework items matched`],
      }

      if (courseworkHits > 0) {
        reasonsWithPoints.push({
          reasonKey: 'coursework.items.legacy_overlap',
          text: describeReason('Recommended coursework', points, `${courseworkHits}/${recommendedCourseworkIds.length} matched`),
          points,
          evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCourseworkIds.length}`],
        })
      }
    } else {
      const recommendedCoursework = parseList(internship.recommended_coursework)
      if (recommendedCoursework.length > 0 && studentCoursework.length > 0) {
        courseworkSignalPathUsed = 'text'
        const courseworkHits = overlapCount(recommendedCoursework, studentCoursework)
        const courseworkRatio = ratio(courseworkHits, recommendedCoursework.length)
        const points = weights.courseworkAlignment * courseworkRatio * 0.6
        signalContributions.courseworkAlignment = {
          signalKey: 'courseworkAlignment',
          weight: weights.courseworkAlignment,
          rawMatchValue: courseworkRatio * 0.6,
          pointsAwarded: points,
          evidence: [`${courseworkHits}/${recommendedCoursework.length} coursework text tokens matched (unverified fallback)`],
        }

        if (courseworkHits > 0) {
          reasonsWithPoints.push({
            reasonKey: 'coursework.text_overlap.fallback',
            text: describeReason('Coursework text overlap used (unverified)', points, `${courseworkHits}/${recommendedCoursework.length} matched`),
            points,
            evidence: [`matched=${courseworkHits}`, `recommended=${recommendedCoursework.length}`],
          })
        }
      }
    }
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.MATCHING_DEBUG_COURSEWORK === '1'
  ) {
    console.info('[matching:coursework]', {
      internshipId: internship.id,
      listingRequiredCanonicalCategoryIds: requiredCanonicalCourseworkCategoryIds,
      listingRequiredCanonicalCategoryNames: requiredCanonicalCourseworkCategoryNames,
      studentCanonicalCourseworkCategoryIds: studentCanonicalCourseworkCategoryIds,
      studentCanonicalCourseworkCategoryNames: studentCanonicalCourseworkCategoryNames,
      studentLegacyCourseworkCategoryIds: studentCourseworkCategoryIds,
      studentLegacyCourseworkItemIds: studentCourseworkIds,
      courseworkSignalPathUsed,
    })
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
        availabilityFit,
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
        availabilityFit,
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
    const matchedMajors = internshipMajors.filter((major) => studentMajors.includes(major))
    const alignmentRatio = majorHits > 0 ? 1 : categoryHit ? 0.5 : 0
    const points = weights.majorCategoryAlignment * alignmentRatio
    signalContributions.majorCategoryAlignment = {
      signalKey: 'majorCategoryAlignment',
      weight: weights.majorCategoryAlignment,
      rawMatchValue: alignmentRatio,
      pointsAwarded: points,
      evidence:
        majorHits > 0
          ? ['Major overlap detected', ...matchedMajors.map((major) => `match:${major}`)]
          : categoryHit
            ? ['Role category aligns with your major']
            : [],
    }

    if (points > 0) {
      const targetedMajorText = internshipMajors.length > 0 ? internshipMajors.join(', ') : internshipCategory
      const matchedMajorText = matchedMajors.length > 0 ? matchedMajors.join(', ') : null
      reasonsWithPoints.push({
        reasonKey: majorHits > 0 ? 'major.overlap' : 'major.category_fallback',
        text: describeReason(
          'Major/category alignment',
          points,
          majorHits > 0
            ? `Target majors include ${targetedMajorText} - your major matches${matchedMajorText ? ` (${matchedMajorText})` : ''}`
            : `category match (${internshipCategory})`
        ),
        points,
        evidence: majorHits > 0 ? ['Major overlap', ...(matchedMajorText ? [matchedMajorText] : [])] : ['Category overlap'],
      })
    } else {
      gaps.push('No major/category alignment')
    }
  }

  const listingHours = typeof internship.hours_per_week === 'number' ? Math.max(1, internship.hours_per_week) : null
  const studentHours = typeof profile.availability_hours_per_week === 'number' ? Math.max(0, profile.availability_hours_per_week) : null
  const hasHoursData = listingHours !== null && studentHours !== null
  const hoursFitRaw = hasHoursData ? clamp01(studentHours / listingHours) : 0.55
  availabilityFit.hours_fit = {
    score: Number((6 * hoursFitRaw).toFixed(1)),
    max: 6,
    label:
      hasHoursData
        ? hoursFitRaw >= 1
          ? `Hours fit: ${formatHours(studentHours)} covers ${formatHours(listingHours)}`
          : `Hours fit: ${formatHours(studentHours)} for a ${formatHours(listingHours)} role`
        : 'Hours fit: add hours/week for better accuracy',
  }
  if (hasHoursData && hoursFitRaw < 1) {
    gaps.push(`This role expects about ${formatHours(listingHours)}; you listed ${formatHours(studentHours)}.`)
  }

  const hasStartData = listingStartMonthIndex !== null && studentStartMonthIndex !== null
  const lateStartMonths = hasStartData ? Math.max(0, studentStartMonthIndex - listingStartMonthIndex) : 0
  let startFitRaw = 0.6
  if (listingStartMonthIndex === null) {
    startFitRaw = 0.6
    availabilityFit.term_fit = {
      score: Number((9 * startFitRaw).toFixed(1)),
      max: 9,
      label: 'Start date fit: listing start date is not specified',
    }
  } else if (studentStartMonthIndex === null) {
    startFitRaw = 0.45
    availabilityFit.term_fit = {
      score: Number((9 * startFitRaw).toFixed(1)),
      max: 9,
      label: 'Start date fit: add your earliest start month',
    }
    gaps.push('Add your earliest start month to improve match accuracy.')
  } else if (lateStartMonths <= 0) {
    startFitRaw = 1
    availabilityFit.term_fit = {
      score: Number((9 * startFitRaw).toFixed(1)),
      max: 9,
      label: `Start date fit: you can start by ${monthNameFromIndex(studentStartMonthIndex)}`,
    }
  } else if (lateStartMonths === 1) {
    startFitRaw = 0.6
    availabilityFit.term_fit = {
      score: Number((9 * startFitRaw).toFixed(1)),
      max: 9,
      label: `Start date fit: one month late (${monthNameFromIndex(studentStartMonthIndex)} vs ${monthNameFromIndex(listingStartMonthIndex)})`,
    }
  } else {
    startFitRaw = 0.1
    availabilityFit.term_fit = {
      score: Number((9 * startFitRaw).toFixed(1)),
      max: 9,
      label: `Start date fit: late by ${lateStartMonths} months`,
    }
  }

  if (hasStartData && lateStartMonths > 0) {
    gaps.push(
      `Late start: role begins in ${monthNameFromIndex(listingStartMonthIndex)}, your earliest start is ${monthNameFromIndex(studentStartMonthIndex)}.`
    )
    gaps.push('This may reduce your fit unless the employer is flexible. Update start month if you can start earlier.')
  }

  signalContributions.startDateFit = {
    signalKey: 'startDateFit',
    weight: weights.startDateFit,
    rawMatchValue: startFitRaw,
    pointsAwarded: weights.startDateFit * startFitRaw,
    evidence: [
      `listing_start_month=${monthNameFromIndex(listingStartMonthIndex)}`,
      `student_start_month=${monthNameFromIndex(studentStartMonthIndex)}`,
      `student_start_source=${studentStartMonthSource}`,
    ],
  }

  if (preferredTerms.length > 0 && listingSeasons.length > 0 && studentStartMonthSource !== 'start_month') {
    const overlap = seasonOverlap({
      studentSeasons: preferredTerms,
      listingSeasons,
    })
    signalContributions.termAlignment = {
      signalKey: 'termAlignment',
      weight: weights.termAlignment,
      rawMatchValue: overlap.listingCoverage,
      pointsAwarded: weights.termAlignment * overlap.listingCoverage,
      evidence: [
        overlap.hasOverlap
          ? `Season fallback overlap: ${formatSeasonsList(overlap.overlapSeasons)}`
          : `Season fallback mismatch: listing ${formatSeasonsList(listingSeasons)} vs ${formatSeasonsList(preferredTerms)}`,
      ],
    }
  } else if (preferredTerms.length > 0 || listingSeasons.length > 0) {
    signalContributions.termAlignment = {
      signalKey: 'termAlignment',
      weight: weights.termAlignment,
      rawMatchValue: 0,
      pointsAwarded: 0,
      evidence: ['insufficient_term_data'],
    }
  }

  const availabilityFraction = clamp01(0.6 * startFitRaw + 0.4 * hoursFitRaw)
  const availabilityPoints = weights.availability * availabilityFraction
  signalContributions.availability = {
    signalKey: 'availability',
    weight: weights.availability,
    rawMatchValue: availabilityFraction,
    pointsAwarded: availabilityPoints,
    evidence: [
      `start_fit=${startFitRaw.toFixed(2)}`,
      `hours_fit=${hoursFitRaw.toFixed(2)}`,
      hasHoursData ? `hours: ${formatHours(studentHours)} vs ${formatHours(listingHours)}` : 'hours: missing',
    ],
  }

  if (hasStartData && lateStartMonths <= 0 && hasHoursData && hoursFitRaw >= 1) {
    reasonsWithPoints.push({
      reasonKey: 'availability.fit',
      text: describeReason(
        'Start date fit',
        availabilityPoints,
        `You can start in ${monthNameFromIndex(studentStartMonthIndex)} for a role beginning ${monthNameFromIndex(listingStartMonthIndex)}`
      ),
      points: availabilityPoints,
      evidence: [`student_start=${monthNameFromIndex(studentStartMonthIndex)}`],
    })
  }

  availabilityFit.category_score = Number((MATCH_CATEGORY_WEIGHTS.availability * availabilityFraction).toFixed(1))
  availabilityFit.status =
    hasStartData && lateStartMonths > 0
      ? 'gap'
      : availabilityStatusFromFraction(availabilityFraction, hasHoursData, listingStartMonthIndex !== null || studentStartMonthIndex !== null)
  if (process.env.NODE_ENV !== 'production' && process.env.MATCHING_DEBUG_AVAILABILITY === '1') {
    console.info('[matching:availability]', {
      internshipId: internship.id,
      listingHoursPerWeek: internship.hours_per_week ?? null,
      studentHoursPerWeek: profile.availability_hours_per_week ?? null,
      preferredTerms,
      listingSeasons,
      availabilityFit,
    })
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

  return finalizeMatchResult({
    internshipId: internship.id,
    reasonsWithPoints,
    gaps,
    eligible: true,
    explain,
    signalContributions,
    weights,
    courseworkSignalPathUsed,
    availabilityFit,
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
