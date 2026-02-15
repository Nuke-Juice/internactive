#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const OUTPUT_PATH = path.join(ROOT, 'SYSTEM_AUDIT_PACK', 'course_catalog_db_status.md')

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

async function main() {
  await loadEnvFromDotLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  const lines = []
  lines.push('# Course Catalog DB Status')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')

  if (!supabaseUrl || !serviceRole) {
    lines.push('- Status: skipped (missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
    await fs.writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
    console.log(`[audit-course-catalog-db-status] wrote ${path.relative(ROOT, OUTPUT_PATH)}`)
    return
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const requiredColumns = ['subject_code', 'course_number', 'title', 'institution', 'category', 'slug']
  const { error: probeError } = await admin
    .from('canonical_courses')
    .select('subject_code, course_number, title, institution, category, slug')
    .limit(1)

  const foundColumns = new Set()
  if (!probeError) {
    for (const col of requiredColumns) foundColumns.add(col)
  } else {
    lines.push(`- Column probe note: ${probeError.message}`)
    lines.push('- Column mode detected: legacy canonical_courses schema (code/name/category_id/level)')
    lines.push('')
  }

  lines.push('## canonical_courses Column Check')
  lines.push('')
  for (const column of requiredColumns) {
    lines.push(`- ${column}: ${foundColumns.has(column) ? 'present' : 'missing'}`)
  }
  lines.push('')

  const { count: totalCount, error: countError } = await admin
    .from('canonical_courses')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    lines.push(`- Count query failed: ${countError.message}`)
  } else {
    lines.push('## Row Counts')
    lines.push('')
    lines.push(`- canonical_courses total: ${totalCount ?? 0}`)
  }

  const { data: groupRows, error: groupError } = await admin
    .from('canonical_courses')
    .select('institution')
    .limit(50000)

  if (groupError) {
    lines.push(`- institution group query failed: ${groupError.message}`)
  } else {
    const byInstitution = {}
    for (const row of groupRows ?? []) {
      const institution = typeof row.institution === 'string' && row.institution.trim() ? row.institution.trim() : '(null)'
      byInstitution[institution] = (byInstitution[institution] ?? 0) + 1
    }

    lines.push('')
    lines.push('## Counts By Institution')
    lines.push('')
    const entries = Object.entries(byInstitution).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    if (entries.length === 0) lines.push('- none')
    else for (const [institution, count] of entries) lines.push(`- ${institution}: ${count}`)
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
  console.log(`[audit-course-catalog-db-status] wrote ${path.relative(ROOT, OUTPUT_PATH)}`)
}

await main()
