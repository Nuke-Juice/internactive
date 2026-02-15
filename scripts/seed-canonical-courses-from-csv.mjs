#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const INPUT_PATH = path.join(ROOT, 'data', 'course_import', 'canonical_courses.proposed.json')
const CHUNK_SIZE = 500

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
  const envPath = path.join(ROOT, '.env.local')
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    const parsed = parseEnvFile(raw)
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Ignore when file is absent.
  }
}

function chunkArray(items, size) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

async function main() {
  await loadEnvFromDotLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env.local')
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const input = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'))
  const courses = Array.isArray(input.courses) ? input.courses : []
  if (courses.length === 0) {
    throw new Error(`No courses found in ${path.relative(ROOT, INPUT_PATH)}`)
  }

  const normalizedCourses = courses
    .map((row) => {
      const institution = normalizeWhitespace(row.institution)
      const subject_code = normalizeWhitespace(row.subject_code).toUpperCase().replace(/[^A-Z]/g, '')
      const course_number = normalizeWhitespace(row.course_number).toUpperCase().replace(/[^0-9A-Z]/g, '')
      if (!institution || !subject_code || !course_number) return null

      const title = normalizeWhitespace(row.title)
      const description = normalizeWhitespace(row.description)
      const category = normalizeWhitespace(row.category) || 'Other'
      const courseCode = `${subject_code} ${course_number}`
      const slug = normalizeWhitespace(row.slug) || slugify(`${institution}-${courseCode}`)

      return {
        slug,
        institution,
        subject_code,
        course_number,
        title: title || null,
        description: description || null,
        category,
        code: courseCode,
        name: title || courseCode,
        level: inferLevel(course_number),
      }
    })
    .filter((row) => row !== null)

  normalizedCourses.sort((a, b) => {
    if (a.institution !== b.institution) return a.institution.localeCompare(b.institution)
    if (a.subject_code !== b.subject_code) return a.subject_code.localeCompare(b.subject_code)
    return a.course_number.localeCompare(b.course_number, undefined, { numeric: true })
  })

  const categoryNames = Array.from(new Set(normalizedCourses.map((row) => row.category))).sort((a, b) =>
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

  const rowsForUpsert = normalizedCourses.map((row) => {
    const categorySlug = slugify(row.category)
    const categoryId = categoryIdBySlug.get(categorySlug)
    if (!categoryId) {
      throw new Error(`Missing category_id for category slug '${categorySlug}'`) 
    }

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

  for (const chunk of chunks) {
    const { error } = await admin.from('canonical_courses').upsert(chunk, { onConflict: 'slug' })
    if (error) throw new Error(`Failed upserting canonical_courses chunk at ${processed}: ${error.message}`)
    processed += chunk.length
  }

  console.log(
    `[seed-canonical-courses-from-csv] upserted_rows=${rowsForUpsert.length} categories=${categoryRows.length} chunks=${chunks.length}`
  )
}

await main()
