export const REQUIRED_APPLY_FIELDS = [
  'school',
  'major',
  'availability_start_month',
  'availability_hours_per_week',
  'graduation_year',
] as const

export const MINIMUM_PROFILE_FIELDS = REQUIRED_APPLY_FIELDS

export type RequiredApplyField = (typeof REQUIRED_APPLY_FIELDS)[number]
export type MinimumProfileField = RequiredApplyField

export type MinimumProfileInput = {
  school?: string | null
  school_id?: string | number | null
  university_id?: string | number | null
  major_id?: string | null
  major?: string | { name?: string | null } | Array<{ name?: string | null }> | null
  majors?: string[] | string | null
  availability_start_month?: string | null
  availability_hours_per_week?: number | string | null
  graduation_year?: number | string | null
  year?: number | string | null
}

export type NormalizedProfileForValidation = {
  school: string | null
  schoolId: string | null
  majorId: string | null
  majors: string[]
  availabilityStartMonth: string | null
  availabilityHoursPerWeek: number | null
  graduationYear: number | null
  graduationYearRaw: string | null
}

export type MinimumProfileCompleteness = {
  ok: boolean
  missing: MinimumProfileField[]
}

const PROFILE_FIELD_LABELS: Record<RequiredApplyField, string> = {
  school: 'School',
  major: 'Major',
  availability_start_month: 'Availability start month',
  availability_hours_per_week: 'Availability hours per week',
  graduation_year: 'Graduation year',
}

function asObject(value: unknown) {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function pickFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function pickFirstId(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function parseMajors(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((major) => String(major).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((major) => major.trim())
      .filter(Boolean)
  }
  return []
}

function parseHours(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseYear(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function hasValidSchool(value: string | null | undefined) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return normalized !== 'not set' && normalized !== 'n/a' && normalized !== 'none'
}

function hasPositiveHours(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasGraduationYear(normalized: NormalizedProfileForValidation) {
  if (typeof normalized.graduationYear === 'number') {
    const minYear = new Date().getFullYear() - 1
    return normalized.graduationYear >= minYear
  }
  // Legacy schema uses `year` (class standing) rather than numeric graduation year.
  return Boolean(normalized.graduationYearRaw && normalized.graduationYearRaw.trim().length > 0)
}

export function normalizeProfileForValidation(rawProfile: MinimumProfileInput | Record<string, unknown> | null | undefined) {
  const record = asObject(rawProfile)
  if (!record) {
    return {
      school: null,
      schoolId: null,
      majorId: null,
      majors: [],
      availabilityStartMonth: null,
      availabilityHoursPerWeek: null,
      graduationYear: null,
      graduationYearRaw: null,
    } satisfies NormalizedProfileForValidation
  }

  const school = pickFirstString(record, ['school'])
  const schoolId = pickFirstId(record, ['school_id', 'university_id', 'schoolId', 'universityId'])
  const majorId = pickFirstId(record, ['major_id', 'majorId'])
  const majorRelationValue = record.major
  const majorFromRelation =
    Array.isArray(majorRelationValue) && majorRelationValue.length > 0
      ? asObject(majorRelationValue[0])?.name
      : asObject(majorRelationValue)?.name
  const majorLabel = typeof majorFromRelation === 'string' ? majorFromRelation.trim() : pickFirstString(record, ['major'])
  const majors = parseMajors(record.majors)
  const mergedMajors = majorLabel ? Array.from(new Set([...majors, majorLabel])) : majors
  const availabilityStartMonth = pickFirstString(record, ['availability_start_month', 'availabilityStartMonth'])
  const availabilityHoursPerWeek = parseHours(record.availability_hours_per_week ?? record.availabilityHoursPerWeek)
  const graduationYearValue = record.graduation_year ?? record.graduationYear ?? record.year
  const graduationYear = parseYear(graduationYearValue)
  const graduationYearRaw =
    typeof graduationYearValue === 'string' && graduationYearValue.trim().length > 0
      ? graduationYearValue.trim()
      : graduationYear !== null
        ? String(graduationYear)
        : null

  return {
    school,
    schoolId,
    majorId,
    majors: mergedMajors,
    availabilityStartMonth,
    availabilityHoursPerWeek,
    graduationYear,
    graduationYearRaw,
  } satisfies NormalizedProfileForValidation
}

export function getMissingProfileFields(profile: MinimumProfileInput | Record<string, unknown> | null | undefined) {
  const normalized = normalizeProfileForValidation(profile)
  const checks: Record<RequiredApplyField, boolean> = {
    school: hasValidSchool(normalized.school) || Boolean(normalized.schoolId),
    major: Boolean(normalized.majorId) || normalized.majors.length > 0,
    availability_start_month: Boolean(normalized.availabilityStartMonth),
    availability_hours_per_week: hasPositiveHours(normalized.availabilityHoursPerWeek),
    graduation_year: hasGraduationYear(normalized),
  }
  return REQUIRED_APPLY_FIELDS.filter((field) => !checks[field])
}

export function isProfileComplete(profile: MinimumProfileInput | Record<string, unknown> | null | undefined) {
  return getMissingProfileFields(profile).length === 0
}

export function getMinimumProfileCompleteness(profile: MinimumProfileInput | null): MinimumProfileCompleteness {
  const missing = getMissingProfileFields(profile)
  return { ok: missing.length === 0, missing }
}

export function getMinimumProfileFieldLabel(field: MinimumProfileField) {
  return PROFILE_FIELD_LABELS[field]
}

export function normalizeMissingProfileFields(input: string | null | undefined): MinimumProfileField[] {
  if (!input) return []
  const values = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const unique = new Set(values)
  return REQUIRED_APPLY_FIELDS.filter((field) => unique.has(field))
}
