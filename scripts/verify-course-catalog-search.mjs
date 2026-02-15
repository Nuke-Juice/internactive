#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const OUTPUT_PATH = path.join(ROOT, 'SYSTEM_AUDIT_PACK', 'course_catalog_verification.md')

const TEST_QUERIES = ['ASTE', 'USU', 'BIOC 6430']

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

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function rowLabel(row) {
  const subject = normalizeWhitespace(row.subject_code)
  const number = normalizeWhitespace(row.course_number)
  const title = normalizeWhitespace(row.title)
  if (subject && number) return normalizeWhitespace(`${subject} ${number} ${title}`)
  return normalizeWhitespace(`${row.code ?? ''} ${row.name ?? ''}`)
}

async function main() {
  await loadEnvFromDotLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  const lines = []
  lines.push('# Course Catalog Verification')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')

  if (!supabaseUrl || !serviceRole) {
    lines.push('- Status: skipped (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await fs.writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
    console.log(`[verify-course-catalog-search] wrote ${path.relative(ROOT, OUTPUT_PATH)}`)
    return
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  lines.push('## Query Checks')
  lines.push('')

  for (const query of TEST_QUERIES) {
    const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    const modern = await admin
      .from('canonical_courses')
      .select('id, subject_code, course_number, title, institution, category, slug, code, name')
      .or(
        `subject_code.ilike.%${safeQuery}%,course_number.ilike.%${safeQuery}%,title.ilike.%${safeQuery}%,institution.ilike.%${safeQuery}%,code.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`
      )
      .limit(20)
    let data = modern.data
    let error = modern.error
    let mode = 'csv-aligned'

    if (error) {
      const legacy = await admin
        .from('canonical_courses')
        .select('id, code, name')
        .or(`code.ilike.%${safeQuery}%,name.ilike.%${safeQuery}%`)
        .limit(20)
      data = (legacy.data ?? []).map((row) => ({
        ...row,
        subject_code: null,
        course_number: null,
        title: null,
        institution: null,
        category: null,
        slug: null,
      }))
      error = legacy.error
      mode = 'legacy-fallback'
    }

    lines.push(`### ${query}`)
    lines.push('')
    lines.push(`- query_mode: ${mode}`)

    if (error) {
      lines.push(`- query_error: ${error.message}`)
      lines.push('')
      continue
    }

    const rows = (data ?? []).map((row) => ({
      id: row.id,
      label: rowLabel(row),
      institution: row.institution,
      category: row.category,
      slug: row.slug,
    }))

    lines.push(`- matches: ${rows.length}`)
    if (rows.length === 0) {
      lines.push('- none')
    } else {
      for (const row of rows.slice(0, 10)) {
        lines.push(`- ${row.label} | institution=${row.institution ?? 'n/a'} | category=${row.category ?? 'n/a'} | slug=${row.slug ?? 'n/a'}`)
      }
    }
    lines.push('')
  }

  lines.push('## Notes')
  lines.push('')
  lines.push('- Programmatic verification runs against canonical_courses directly (same source used by API search route).')
  lines.push('- UI combobox calls /api/coursework/search and should reflect these records after seeding.')

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
  console.log(`[verify-course-catalog-search] wrote ${path.relative(ROOT, OUTPUT_PATH)}`)
}

await main()
