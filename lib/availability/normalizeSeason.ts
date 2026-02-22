export type CanonicalSeason = 'spring' | 'summer' | 'fall' | 'winter'

const SEASON_ORDER: CanonicalSeason[] = ['spring', 'summer', 'fall', 'winter']
const MONTHS = [
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

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function monthIndexFromToken(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return -1
  for (let index = 0; index < MONTHS.length; index += 1) {
    const month = MONTHS[index]
    if (month.startsWith(normalized.slice(0, 3))) return index
  }
  return -1
}

export function seasonFromMonthIndex(monthIndex: number): CanonicalSeason | null {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return null
  if (monthIndex === 11 || monthIndex === 0) return 'winter'
  if (monthIndex >= 1 && monthIndex <= 3) return 'spring'
  if (monthIndex >= 4 && monthIndex <= 7) return 'summer'
  return 'fall'
}

export function normalizeSeason(value: string | null | undefined): CanonicalSeason | null {
  const normalized = normalizeText(value ?? '')
  if (!normalized) return null
  if (normalized.includes('spring')) return 'spring'
  if (normalized.includes('summer')) return 'summer'
  if (normalized.includes('fall') || normalized.includes('autumn')) return 'fall'
  if (normalized.includes('winter')) return 'winter'

  const monthIndex = monthIndexFromToken(normalized)
  if (monthIndex >= 0) return seasonFromMonthIndex(monthIndex)
  return null
}

function parseRangeMonths(value: string): { start: number; end: number } | null {
  const monthNamePattern =
    '(January|February|March|April|May|June|July|August|September|October|November|December)'
  const range = new RegExp(`${monthNamePattern}\\s+\\d{4}\\s*-\\s*${monthNamePattern}\\s+\\d{4}`, 'i')
  const match = value.match(range)
  if (!match) return null
  const start = monthIndexFromToken(match[1] ?? '')
  const end = monthIndexFromToken(match[2] ?? '')
  if (start < 0 || end < 0) return null
  return { start, end }
}

function seasonsFromMonthSpan(startMonthIndex: number, endMonthIndex: number): CanonicalSeason[] {
  const results = new Set<CanonicalSeason>()
  let monthIndex = startMonthIndex
  let guard = 0
  while (guard < 24) {
    const season = seasonFromMonthIndex(monthIndex)
    if (season) results.add(season)
    if (monthIndex === endMonthIndex) break
    monthIndex = (monthIndex + 1) % 12
    guard += 1
  }
  return SEASON_ORDER.filter((season) => results.has(season))
}

function extractSeasonsFromMonthTokens(value: string) {
  const results = new Set<CanonicalSeason>()
  for (const month of MONTHS) {
    if (!value.includes(month) && !value.includes(month.slice(0, 3))) continue
    const monthIndex = monthIndexFromToken(month)
    const season = seasonFromMonthIndex(monthIndex)
    if (season) results.add(season)
  }
  return SEASON_ORDER.filter((season) => results.has(season))
}

export function normalizeSeasonsFromValue(value: string | null | undefined): CanonicalSeason[] {
  const normalized = normalizeText(value ?? '')
  if (!normalized) return []

  const explicitSeasons = new Set<CanonicalSeason>()
  if (normalized.includes('spring')) explicitSeasons.add('spring')
  if (normalized.includes('summer')) explicitSeasons.add('summer')
  if (normalized.includes('fall') || normalized.includes('autumn')) explicitSeasons.add('fall')
  if (normalized.includes('winter')) explicitSeasons.add('winter')
  if (explicitSeasons.size > 0) return SEASON_ORDER.filter((season) => explicitSeasons.has(season))

  const range = parseRangeMonths(normalized)
  if (range) {
    return seasonsFromMonthSpan(range.start, range.end)
  }

  const monthTokenSeasons = extractSeasonsFromMonthTokens(normalized)
  if (monthTokenSeasons.length > 0) return monthTokenSeasons

  const single = normalizeSeason(normalized)
  return single ? [single] : []
}

export function normalizePreferredSeasons(params: {
  preferredTerms?: string[] | null
  availabilityStartMonth?: string | null
}) {
  const explicit = (params.preferredTerms ?? []).flatMap((value) => normalizeSeasonsFromValue(value))
  const fromStartMonth = normalizeSeason(params.availabilityStartMonth ?? null)
  const merged = Array.from(new Set([...(explicit ?? []), ...(fromStartMonth ? [fromStartMonth] : [])]))
  if (merged.length > 0) return merged

  return []
}

export function normalizeListingSeasons(params: {
  term?: string | null
  startDate?: string | null
}) {
  const byTerm = normalizeSeasonsFromValue(params.term ?? null)
  if (byTerm.length > 0) return byTerm

  const startDate = (params.startDate ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const monthIndex = Number(startDate.slice(5, 7)) - 1
    const season = seasonFromMonthIndex(monthIndex)
    return season ? [season] : []
  }
  return []
}

export function formatSeasonsList(seasons: CanonicalSeason[]) {
  if (seasons.length === 0) return 'unknown'
  return seasons.join(', ')
}
