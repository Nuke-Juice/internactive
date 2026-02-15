import { NextResponse } from 'next/server'
import { getUniversityCourseCatalog } from '@/lib/coursework/universityCourseCatalog'
import { supabaseServer } from '@/lib/supabase/server'

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

function toCourseLabel(row: DbCourseRow) {
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

export async function GET(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = normalizeWhitespace(searchParams.get('query') ?? '')
  const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const university = normalizeWhitespace(searchParams.get('university') ?? '')
  const searchAll = searchParams.get('searchAll') === '1'

  if (query.length < 2 || safeQuery.length < 2) return NextResponse.json({ results: [] })

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
    .map((row) => ({ id: row.id ?? `db:${normalizeCodeToken(toCourseLabel(row))}`, label: toCourseLabel(row) }))
    .filter((row) => row.label.length > 0)
    .filter((row) => matchesQuery(row.label, safeQuery))

  const scopedResults: CourseResult[] = !searchAll
    ? getUniversityCourseCatalog(university)
        .filter((item) => matchesQuery(item, safeQuery))
        .map((item) => ({ id: `scoped:${normalizeCodeToken(item)}`, label: item }))
    : []

  const merged = mergeAndSortResults([...scopedResults, ...dbResults], safeQuery)
  const deduped = merged.filter((item, index, source) => {
    const token = normalizeLabelToken(item.label)
    return source.findIndex((candidate) => normalizeLabelToken(candidate.label) === token) === index
  })

  return NextResponse.json({ results: deduped.slice(0, MAX_RESULTS) })
}
