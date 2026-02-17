export type CourseworkLevelBand = 'intro' | 'intermediate' | 'advanced'

const SUBJECT_ALIAS_MAP: Record<string, string> = {
  ACC: 'ACCT',
  ACCT: 'ACCT',
  ACCTG: 'ACCT',
  FIN: 'FIN',
  FINAN: 'FIN',
  CS: 'CS',
  CSCI: 'CS',
}

const SUBJECT_TO_CANONICAL_CATEGORY_SLUG: Record<string, string> = {
  ACCT: 'finance-accounting',
  FIN: 'finance-accounting',
  CS: 'software-engineering',
}

function firstDigits(value: string | null | undefined) {
  const match = String(value ?? '').match(/(\d{3,4})/)
  return match ? Number.parseInt(match[1], 10) : null
}

export function normalizeSubjectAlias(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (!normalized) return ''
  return SUBJECT_ALIAS_MAP[normalized] ?? normalized
}

export function inferCanonicalCategorySlugFromSubject(subjectCode: string | null | undefined) {
  const canonicalSubject = normalizeSubjectAlias(subjectCode)
  return SUBJECT_TO_CANONICAL_CATEGORY_SLUG[canonicalSubject] ?? null
}

export function inferLevelBandFromCourseNumber(courseNumber: string | null | undefined): CourseworkLevelBand {
  const n = firstDigits(courseNumber)
  if (n === null || Number.isNaN(n)) return 'intermediate'

  // Support both 3-digit and 4-digit catalogs by mapping to the hundred-level.
  const hundredLevel = n >= 1000 ? Math.floor(n / 100) : Math.floor(n / 100) * 10

  if (hundredLevel < 20) return 'intro'
  if (hundredLevel < 30) return 'intermediate'
  return 'advanced'
}
