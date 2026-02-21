import { getUniversityCourseCatalog } from '@/lib/coursework/universityCourseCatalog'
import { supabaseServer } from '@/lib/supabase/server'
import { jsonError, jsonOk } from '@/src/server/api/respond'

const MAX_RESULTS = 10
const DB_FETCH_LIMIT = 80

type CourseResult = {
  id: string
  label: string
}

type DbCourseRow = {
  id: string | null
  subject_code: string | null
  course_number: string | null
  title: string | null
  institution: string | null
  category: string | null
  slug: string | null
  code: string | null
  name: string | null
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeCodeToken(value: string) {
  return normalizeWhitespace(value).toUpperCase().replace(/\s+/g, '')
}

function normalizeLabelToken(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

function normalizeUniversityToken(value: string) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function insertCourseBoundaries(value: string) {
  return value
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z]{2,})/g, '$1 $2')
}

function toShortCourseLabel(value: string) {
  const normalized = normalizeWhitespace(value)
  const withBoundaries = insertCourseBoundaries(normalized)
  const match = withBoundaries.match(/^([A-Za-z][A-Za-z&\-\s]{0,20}?)\s+([0-9]{2,4}[A-Za-z]?)\b/)
  if (!match) return normalized
  const subject = normalizeWhitespace(match[1]).toUpperCase()
  const number = match[2].toUpperCase()
  return `${subject} ${number}`
}

function expandCodeAliases(token: string) {
  const aliases = new Set([token])
  if (token.startsWith('ACC')) aliases.add(token.replace(/^ACC/, 'ACCTG'))
  if (token.startsWith('ACCTG')) aliases.add(token.replace(/^ACCTG/, 'ACC'))
  return Array.from(aliases)
}

function matchesQuery(label: string, query: string) {
  const normalizedQuery = normalizeCodeToken(query)
  const lowerQuery = normalizeWhitespace(query).toLowerCase()
  if (!normalizedQuery && !lowerQuery) return false

  const labelLower = label.toLowerCase()
  const labelCode = normalizeCodeToken(label)
  const aliasTokens = expandCodeAliases(normalizedQuery)

  return aliasTokens.some((token) => labelCode.includes(token)) || labelLower.includes(lowerQuery)
}

function rankCourse(label: string, query: string) {
  const normalizedQuery = normalizeCodeToken(query)
  const lowerQuery = normalizeWhitespace(query).toLowerCase()
  const aliasTokens = expandCodeAliases(normalizedQuery)
  const labelCode = normalizeCodeToken(label)
  const labelLower = label.toLowerCase()

  let score = 0
  if (aliasTokens.some((token) => labelCode.startsWith(token))) score += 200
  else if (aliasTokens.some((token) => labelCode.includes(token))) score += 120
  if (labelLower.includes(lowerQuery)) score += 80
  return score
}

function mergeAndSortResults(items: CourseResult[], query: string) {
  return items
    .slice()
    .sort((a, b) => {
      const scoreDiff = rankCourse(b.label, query) - rankCourse(a.label, query)
      if (scoreDiff !== 0) return scoreDiff
      return a.label.localeCompare(b.label)
    })
    .slice(0, MAX_RESULTS)
}

function extractCourseKey(label: string) {
  const normalized = toShortCourseLabel(label)
  const codeMatch = normalized.match(/^([A-Za-z]{2,12})\s*([0-9]{2,4}[A-Za-z]?)\b/)
  if (!codeMatch) return normalizeLabelToken(normalized)
  const subject = codeMatch[1].toUpperCase()
  const number = codeMatch[2].toUpperCase()
  return `${subject}:${number}`
}

function dedupeByCourseKey(items: CourseResult[], query: string) {
  const bestByKey = new Map<string, CourseResult>()

  for (const item of items) {
    const key = extractCourseKey(item.label)
    const existing = bestByKey.get(key)
    if (!existing) {
      bestByKey.set(key, item)
      continue
    }

    const existingScore = rankCourse(existing.label, query)
    const candidateScore = rankCourse(item.label, query)
    if (candidateScore > existingScore) {
      bestByKey.set(key, item)
      continue
    }

    if (candidateScore === existingScore && item.label.length < existing.label.length) {
      bestByKey.set(key, item)
    }
  }

  return Array.from(bestByKey.values())
}

function toCourseLabel(row: DbCourseRow) {
  const subjectCode = typeof row.subject_code === 'string' ? normalizeWhitespace(row.subject_code) : ''
  const courseNumber = typeof row.course_number === 'string' ? normalizeWhitespace(row.course_number) : ''
  if (subjectCode && courseNumber) {
    return normalizeWhitespace(`${subjectCode} ${courseNumber}`)
  }

  const code = typeof row.code === 'string' ? normalizeWhitespace(row.code) : ''
  if (code) return toShortCourseLabel(code)
  const name = typeof row.name === 'string' ? normalizeWhitespace(row.name) : ''
  return name
}

function toCourseSearchText(row: DbCourseRow) {
  const subjectCode = typeof row.subject_code === 'string' ? normalizeWhitespace(row.subject_code) : ''
  const courseNumber = typeof row.course_number === 'string' ? normalizeWhitespace(row.course_number) : ''
  const title = typeof row.title === 'string' ? normalizeWhitespace(row.title) : ''
  if (subjectCode && courseNumber) {
    return normalizeWhitespace(`${subjectCode} ${courseNumber} ${title}`)
  }

  const code = typeof row.code === 'string' ? normalizeWhitespace(row.code) : ''
  const name = typeof row.name === 'string' ? normalizeWhitespace(row.name) : ''
  return normalizeWhitespace(`${code} ${name}`)
}

function withInstitutionSuffix(label: string, row: DbCourseRow, selectedUniversity: string) {
  const institution = typeof row.institution === 'string' ? normalizeWhitespace(row.institution) : ''
  if (!institution) return label

  const selectedToken = normalizeUniversityToken(selectedUniversity)
  const institutionToken = normalizeUniversityToken(institution)

  if (selectedToken && selectedToken === institutionToken) return label
  return `${label} (${institution})`
}

export async function GET(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError('Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const query = normalizeWhitespace(searchParams.get('query') ?? '')
  const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const university = normalizeWhitespace(searchParams.get('university') ?? '')
  const searchAll = searchParams.get('searchAll') === '1'

  if (query.length < 2 || safeQuery.length < 2) return jsonOk({ results: [] })

  const db = supabase
    .from('canonical_courses')
    .select('id, subject_code, course_number, title, institution, category, slug, code, name')
    .or(
      `subject_code.ilike.%${safeQuery}%,course_number.ilike.%${safeQuery}%,title.ilike.%${safeQuery}%,institution.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`
    )
    .limit(DB_FETCH_LIMIT)

  const { data: dbRows, error: dbError } = await db
  let effectiveDbRows: DbCourseRow[] = (dbRows ?? []) as DbCourseRow[]

  if (dbError) {
    const legacy = await supabase
      .from('canonical_courses')
      .select('id, code, name')
      .or(`code.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`)
      .limit(DB_FETCH_LIMIT)

    effectiveDbRows = (legacy.data ?? []).map((row) => ({
      id: typeof row.id === 'string' ? row.id : null,
      subject_code: null,
      course_number: null,
      title: null,
      institution: null,
      category: null,
      slug: null,
      code: typeof row.code === 'string' ? row.code : null,
      name: typeof row.name === 'string' ? row.name : null,
    }))
  }

  const dbResults: CourseResult[] = effectiveDbRows
    .filter((row): row is DbCourseRow => {
      return typeof row.id === 'string'
    })
    .map((row) => {
      const baseLabel = toCourseLabel(row)
      return {
        id: row.id ?? `db:${normalizeCodeToken(baseLabel)}`,
        label: withInstitutionSuffix(baseLabel, row, university),
        searchText: toCourseSearchText(row),
      }
    })
    .filter((row) => row.label.length > 0)
    .filter((row) => matchesQuery(row.searchText, safeQuery))
    .map((row) => ({ id: row.id, label: row.label }))

  const scopedResults: CourseResult[] = !searchAll
    ? getUniversityCourseCatalog(university)
        .filter((item) => matchesQuery(item, safeQuery))
        .map((item) => {
          const shortLabel = toShortCourseLabel(item)
          return { id: `scoped:${normalizeCodeToken(shortLabel)}`, label: shortLabel }
        })
    : []

  const deduped = dedupeByCourseKey([...scopedResults, ...dbResults], safeQuery)
  const merged = mergeAndSortResults(deduped, safeQuery)

  return jsonOk({ results: merged })
}
