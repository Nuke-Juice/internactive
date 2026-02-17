const DIRECT_ALIASES: Record<string, string> = {
  excel: 'excel',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  'excel modeling': 'excel',
  'financial modeling in excel': 'excel',
  'google sheets': 'spreadsheets',
  spreadsheets: 'spreadsheets',
  'written communication': 'communication',
  'communication skills': 'communication',
  communication: 'communication',
  'verbal communication': 'communication',
  'attention to detail': 'attention to detail',
  'detail oriented': 'attention to detail',
  'detail-oriented': 'attention to detail',
}

function normalizeBase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function normalizeSkillForMatching(value: string) {
  const normalized = normalizeBase(value)
  if (!normalized) return ''
  const direct = DIRECT_ALIASES[normalized]
  if (direct) return direct

  if (/\b(ms|microsoft)\s*excel\b/.test(normalized)) return 'excel'
  if (/\b(communication)\b/.test(normalized)) return 'communication'
  if (/\battention\b.*\bdetail\b/.test(normalized)) return 'attention to detail'

  return normalized
}

export function normalizeSkillListForMatching(values: string[] | null | undefined) {
  if (!values || values.length === 0) return [] as string[]
  return Array.from(
    new Set(
      values
        .map((value) => normalizeSkillForMatching(value))
        .filter(Boolean)
    )
  )
}

