import { NextResponse } from 'next/server'
import { getUniversityCourseCatalog } from '@/lib/coursework/universityCourseCatalog'
import { supabaseServer } from '@/lib/supabase/server'

const MAX_RESULTS = 10
const DB_FETCH_LIMIT = 80

type CourseResult = {
  id: string
  label: string
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
    .select('id, code, name')
    .or(`code.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`)
    .limit(DB_FETCH_LIMIT)

  const { data: dbRows } = await db
  const dbResults: CourseResult[] = (dbRows ?? [])
    .filter((row): row is { id: string; code: string; name: string } => {
      return typeof row.id === 'string' && typeof row.code === 'string' && typeof row.name === 'string'
    })
    .map((row) => ({ id: row.id, label: normalizeWhitespace(`${row.code} ${row.name}`) }))
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
