#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()

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

function percent(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
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

  const [{ count: internshipTotal }, { count: studentTotal }] = await Promise.all([
    admin.from('internships').select('id', { head: true, count: 'exact' }),
    admin.from('student_profiles').select('user_id', { head: true, count: 'exact' }),
  ])

  const [
    { data: canonicalListingRows },
    { data: legacyListingCategoryRows },
    { data: legacyListingItemRows },
    { data: canonicalStudentRows },
    { data: legacyStudentCategoryRows },
    { data: legacyStudentItemRows },
  ] = await Promise.all([
    admin.from('internship_required_course_categories').select('internship_id').limit(200000),
    admin.from('internship_coursework_category_links').select('internship_id').limit(200000),
    admin.from('internship_coursework_items').select('internship_id').limit(200000),
    admin.from('student_courses').select('student_profile_id').limit(200000),
    admin.from('student_coursework_category_links').select('student_id').limit(200000),
    admin.from('student_coursework_items').select('student_id').limit(200000),
  ])

  const canonicalInternshipIds = new Set((canonicalListingRows ?? []).map((row) => row.internship_id).filter(Boolean))
  const legacyInternshipIds = new Set(
    [...(legacyListingCategoryRows ?? []).map((row) => row.internship_id), ...(legacyListingItemRows ?? []).map((row) => row.internship_id)]
      .filter(Boolean)
  )

  const canonicalStudentIds = new Set((canonicalStudentRows ?? []).map((row) => row.student_profile_id).filter(Boolean))
  const legacyStudentIds = new Set(
    [...(legacyStudentCategoryRows ?? []).map((row) => row.student_id), ...(legacyStudentItemRows ?? []).map((row) => row.student_id)]
      .filter(Boolean)
  )

  const totalInternships = internshipTotal ?? 0
  const totalStudents = studentTotal ?? 0

  console.log('=== Coursework Coverage Report ===')
  console.log(`Internships total: ${totalInternships}`)
  console.log(
    `Internships with canonical requirements: ${canonicalInternshipIds.size} (${percent(canonicalInternshipIds.size, totalInternships)}%)`
  )
  console.log(
    `Internships with legacy requirements: ${legacyInternshipIds.size} (${percent(legacyInternshipIds.size, totalInternships)}%)`
  )
  console.log('')
  console.log(`Students total: ${totalStudents}`)
  console.log(
    `Students with canonical coursework: ${canonicalStudentIds.size} (${percent(canonicalStudentIds.size, totalStudents)}%)`
  )
  console.log(
    `Students with legacy coursework: ${legacyStudentIds.size} (${percent(legacyStudentIds.size, totalStudents)}%)`
  )
}

await main()
