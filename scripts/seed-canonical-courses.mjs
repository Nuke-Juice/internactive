#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const INPUT_PATH = path.join(ROOT, 'data', 'course_import', 'canonical_courses.proposed.json')
const CHUNK_SIZE = 500
const DRY_RUN = process.argv.includes('--dry-run')

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function inferLevel(courseNumber) {
  const match = String(courseNumber ?? '').match(/^(\d+)/)
  const n = match ? Number.parseInt(match[1], 10) : null
  if (n == null || Number.isNaN(n)) return 'intermediate'
  if (n < 3000) return 'intro'
  if (n < 5000) return 'intermediate'
  return 'advanced'
}

function parseEnvFile(raw) {
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function loadEnvFromDotLocal() {
  try {
    const raw = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8')
    const parsed = parseEnvFile(raw)
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // ignore
  }
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function isMissingColumnError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  return message.includes('column') && message.includes('does not exist')
}

function normalizeCourseRows(inputRows) {
  const rows = []
  for (const raw of inputRows) {
    const institution = normalizeWhitespace(raw.institution)
    const subjectCode = normalizeWhitespace(raw.subject_code).toUpperCase().replace(/[^A-Z]/g, '')
    const courseNumber = normalizeWhitespace(raw.course_number).toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (!institution || !subjectCode || !courseNumber) continue

    const title = normalizeWhitespace(raw.title)
    const description = normalizeWhitespace(raw.description)
    const category = normalizeWhitespace(raw.category) || 'Other'
    const code = `${subjectCode} ${courseNumber}`
    const slug = normalizeWhitespace(raw.slug) || slugify(`${institution}-${code}`)

    rows.push({
      slug,
      institution,
      subject_code: subjectCode,
      course_number: courseNumber,
      title: title || null,
      description: description || null,
      category,
      code,
      name: title || code,
      level: inferLevel(courseNumber),
    })
  }

  rows.sort((a, b) => {
    if (a.institution !== b.institution) return a.institution.localeCompare(b.institution)
    if (a.subject_code !== b.subject_code) return a.subject_code.localeCompare(b.subject_code)
    return a.course_number.localeCompare(b.course_number, undefined, { numeric: true })
  })

  return rows
}

function computeInstitutionCounts(rows) {
  const counts = {}
  for (const row of rows) {
    counts[row.institution] = (counts[row.institution] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

async function main() {
  await loadEnvFromDotLocal()

  const input = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'))
  const inputRows = Array.isArray(input.courses) ? input.courses : []
  if (inputRows.length === 0) throw new Error(`No courses found in ${path.relative(ROOT, INPUT_PATH)}`)

  const normalizedRows = normalizeCourseRows(inputRows)
  const institutionCounts = computeInstitutionCounts(normalizedRows)

  console.log(`[seed-canonical-courses] source_rows=${inputRows.length} normalized_rows=${normalizedRows.length}`)
  for (const [institution, count] of Object.entries(institutionCounts)) {
    console.log(`[seed-canonical-courses] institution=${institution} count=${count}`)
  }

  if (DRY_RUN) {
    console.log('[seed-canonical-courses] dry-run complete (no DB writes).')
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local')
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const categoryNames = Array.from(new Set(normalizedRows.map((row) => row.category))).sort((a, b) =>
    a.localeCompare(b)
  )
  const categoryRows = categoryNames.map((name) => ({ slug: slugify(name), name }))

  const { error: categoryUpsertError } = await admin
    .from('canonical_course_categories')
    .upsert(categoryRows, { onConflict: 'slug' })
  if (categoryUpsertError) {
    throw new Error(`Failed upserting canonical_course_categories: ${categoryUpsertError.message}`)
  }

  const { data: categoryData, error: categoryFetchError } = await admin
    .from('canonical_course_categories')
    .select('id, slug')
    .in(
      'slug',
      categoryRows.map((row) => row.slug)
    )
  if (categoryFetchError || !categoryData) {
    throw new Error(`Failed loading canonical_course_categories: ${categoryFetchError?.message ?? 'unknown error'}`)
  }

  const categoryIdBySlug = new Map(categoryData.map((row) => [row.slug, row.id]))

  const rowsForUpsert = normalizedRows.map((row) => {
    const categorySlug = slugify(row.category)
    const categoryId = categoryIdBySlug.get(categorySlug)
    if (!categoryId) throw new Error(`Missing category_id for category slug '${categorySlug}'`)

    return {
      slug: row.slug,
      institution: row.institution,
      subject_code: row.subject_code,
      course_number: row.course_number,
      title: row.title,
      description: row.description,
      category: row.category,
      code: row.code,
      name: row.name,
      level: row.level,
      category_id: categoryId,
    }
  })

  const chunks = chunkArray(rowsForUpsert, CHUNK_SIZE)
  let processed = 0
  let usedLegacyFallback = false

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]

    let upsertError = null
    let mode = 'csv-schema'

    const modern = await admin.from('canonical_courses').upsert(chunk, { onConflict: 'slug' })
    upsertError = modern.error

    if (upsertError && isMissingColumnError(upsertError)) {
      usedLegacyFallback = true
      mode = 'legacy-schema'

      const legacyChunk = chunk.map((row) => ({
        code: row.code,
        name: row.name,
        category_id: row.category_id,
        level: row.level,
      }))
      const legacy = await admin.from('canonical_courses').upsert(legacyChunk, { onConflict: 'code,category_id' })
      upsertError = legacy.error
    }

    if (upsertError) {
      throw new Error(
        `Failed upserting canonical_courses chunk ${i + 1}/${chunks.length}: ${upsertError.message}`
      )
    }

    processed += chunk.length
    console.log(
      `[seed-canonical-courses] chunk=${i + 1}/${chunks.length} mode=${mode} upserted=${processed}/${rowsForUpsert.length}`
    )
  }

  console.log(
    `[seed-canonical-courses] complete rows_upserted=${rowsForUpsert.length} schema_mode=${usedLegacyFallback ? 'legacy-fallback' : 'csv-aligned'}`
  )
}

await main()
