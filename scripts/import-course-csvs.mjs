#!/usr/bin/env node

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const INPUTS = [
  {
    institution: 'University of Utah',
    institutionKey: 'UOFU',
    inputPath: path.join(ROOT, 'data', 'catalog_imports', 'utah_courses.csv'),
    outputPath: path.join(ROOT, 'data', 'course_import', 'utah.normalized.jsonl'),
  },
  {
    institution: 'Brigham Young University',
    institutionKey: 'BYU',
    inputPath: path.join(ROOT, 'data', 'catalog_imports', 'byu_courses.csv'),
    outputPath: path.join(ROOT, 'data', 'course_import', 'byu.normalized.jsonl'),
  },
  {
    institution: 'Utah State University',
    institutionKey: 'USU',
    inputPath: path.join(ROOT, 'data', 'catalog_imports', 'usu_courses.csv'),
    outputPath: path.join(ROOT, 'data', 'course_import', 'usu.normalized.jsonl'),
  },
]

const CATEGORY_MAP_PATH = path.join(ROOT, 'scripts', 'course-category-map.json')
const OUTPUT_DIR = path.join(ROOT, 'data', 'course_import')
const REJECTED_PATH = path.join(OUTPUT_DIR, 'rejected.jsonl')
const COMBINED_PATH = path.join(OUTPUT_DIR, 'combined.deduped.sorted.json')
const CANONICAL_PATH = path.join(OUTPUT_DIR, 'canonical_courses.proposed.json')
const AUDIT_PATH = path.join(ROOT, 'SYSTEM_AUDIT_PACK', 'course_csv_import_audit.md')

const VERIFY_ONLY = process.argv.includes('--verify')

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeSubject(value) {
  return normalizeWhitespace(value).toUpperCase().replace(/[^A-Z]/g, '')
}

function normalizeCourseNumber(value) {
  const compact = normalizeWhitespace(value).toUpperCase().replace(/\s+/g, '')
  if (!compact) return ''
  const exact = compact.match(/^(\d+)([A-Z]*)$/)
  if (exact) return `${exact[1]}${exact[2]}`
  const prefix = compact.match(/(\d+)([A-Z]*)/)
  return prefix ? `${prefix[1]}${prefix[2]}` : ''
}

function normalizeSubjectFromDedicatedColumn(value) {
  const collapsed = normalizeWhitespace(value).toUpperCase()
  if (!collapsed) return { normalized: '', collapsed: '', hadSpacesRemoved: false }
  const noSpaces = collapsed.replace(/\s+/g, '')
  return {
    normalized: noSpaces.replace(/[^A-Z]/g, ''),
    collapsed,
    hadSpacesRemoved: /\s/.test(collapsed),
  }
}

function institutionSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function parseCourseToken(text) {
  const source = normalizeWhitespace(text)
  if (!source) return null

  const patterns = [
    /\b([A-Za-z&]{2,10})\s*[- ]\s*(\d{2,4}[A-Za-z]{0,2})\b/,
    /\b([A-Za-z&]{2,10})(\d{2,4}[A-Za-z]{0,2})\b/,
    /\b([A-Za-z&]{2,10})\s+(\d{2,4}[A-Za-z]{0,2})\b/,
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (!match) continue
    const subject = normalizeSubject(match[1])
    const number = normalizeCourseNumber(match[2])
    if (subject && number) return { subject_code: subject, course_number: number }
  }

  return null
}

function findColumnIndex(headers, hints) {
  const normalized = headers.map((h) => normalizeHeader(h))

  for (const hint of hints) {
    const target = normalizeHeader(hint)
    const exact = normalized.findIndex((h) => h === target)
    if (exact >= 0) return exact
  }

  for (const hint of hints) {
    const target = normalizeHeader(hint)
    const include = normalized.findIndex((h) => h.includes(target))
    if (include >= 0) return include
  }

  return -1
}

function parseCsvRowToObject(headers, row) {
  const out = {}
  for (let i = 0; i < headers.length; i += 1) {
    out[headers[i]] = row[i] ?? ''
  }
  return out
}

function compareCourseNumber(a, b) {
  const pa = String(a ?? '').toUpperCase().match(/^(\d+)([A-Z]*)$/)
  const pb = String(b ?? '').toUpperCase().match(/^(\d+)([A-Z]*)$/)

  if (pa && pb) {
    const na = Number.parseInt(pa[1], 10)
    const nb = Number.parseInt(pb[1], 10)
    if (na !== nb) return na - nb
    if (pa[2] !== pb[2]) return pa[2].localeCompare(pb[2])
    return String(a).localeCompare(String(b))
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function sortCombinedRows(rows) {
  rows.sort((a, b) => {
    if (a.institution !== b.institution) return a.institution.localeCompare(b.institution)
    if (a.subject_code !== b.subject_code) return a.subject_code.localeCompare(b.subject_code)
    return compareCourseNumber(a.course_number, b.course_number)
  })
}

function isPreferredCandidate(candidate, existing) {
  const candidateHasTitle = Boolean(candidate.title)
  const existingHasTitle = Boolean(existing.title)
  if (candidateHasTitle !== existingHasTitle) return candidateHasTitle

  const candidateDescLength = (candidate.description || '').length
  const existingDescLength = (existing.description || '').length
  if (candidateDescLength !== existingDescLength) return candidateDescLength > existingDescLength

  const candidateTitleLength = (candidate.title || '').length
  const existingTitleLength = (existing.title || '').length
  if (candidateTitleLength !== existingTitleLength) return candidateTitleLength > existingTitleLength

  if (candidate.source_file !== existing.source_file) {
    return candidate.source_file.localeCompare(existing.source_file) < 0
  }
  return candidate.source_row_number < existing.source_row_number
}

async function* parseCsvRecords(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' })

  let field = ''
  let row = []
  let inQuotes = false

  for await (const chunk of stream) {
    for (let i = 0; i < chunk.length; i += 1) {
      const ch = chunk[i]

      if (ch === '"') {
        const next = chunk[i + 1]
        if (inQuotes && next === '"') {
          field += '"'
          i += 1
          continue
        }
        inQuotes = !inQuotes
        continue
      }

      if (!inQuotes && ch === ',') {
        row.push(field)
        field = ''
        continue
      }

      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        row.push(field)
        field = ''
        if (ch === '\r' && chunk[i + 1] === '\n') i += 1

        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          yield row
        }

        row = []
        continue
      }

      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
      yield row
    }
  }
}

async function processCsv(inputConfig, rejectedWriter) {
  const { institution, institutionKey, inputPath, outputPath } = inputConfig
  const outputWriter = fs.createWriteStream(outputPath, { encoding: 'utf8' })

  const stats = {
    institution,
    input_file: path.relative(ROOT, inputPath),
    headers: [],
    processed_rows: 0,
    accepted_rows: 0,
    rejected_rows: 0,
    recovered_rows_due_to_subject_space_normalization: 0,
    subject_space_transforms: {},
  }

  const acceptedRows = []

  let headerRow = null
  let rowNumber = 0
  let mapping = null

  for await (const row of parseCsvRecords(inputPath)) {
    if (!headerRow) {
      headerRow = row.map((value) => String(value).replace(/^\uFEFF/, ''))
      stats.headers = headerRow

      mapping = {
        subject: findColumnIndex(headerRow, ['subject code', 'subject', 'dept', 'department', 'teaching area']),
        courseNumber: findColumnIndex(headerRow, ['catalog number', 'course number', 'course no', 'number']),
        title: findColumnIndex(headerRow, ['course title', 'title', 'name']),
        description: findColumnIndex(headerRow, ['description', 'course description', 'catalog description']),
        combinedCourse: findColumnIndex(headerRow, ['course code', 'course', 'class']),
      }

      continue
    }

    rowNumber += 1
    stats.processed_rows += 1

    const rowObject = parseCsvRowToObject(headerRow, row)

    const subjectRaw = mapping.subject >= 0 ? row[mapping.subject] : ''
    const courseNumberRaw = mapping.courseNumber >= 0 ? row[mapping.courseNumber] : ''
    const combinedRaw = mapping.combinedCourse >= 0 ? row[mapping.combinedCourse] : ''

    let extracted = null
    const hadDedicatedSubjectAndCourse =
      normalizeWhitespace(subjectRaw).length > 0 && normalizeWhitespace(courseNumberRaw).length > 0
    const legacyCombinedExtraction = hadDedicatedSubjectAndCourse
      ? parseCourseToken(`${subjectRaw} ${courseNumberRaw}`)
      : null

    if (hadDedicatedSubjectAndCourse) {
      const subjectFromColumn = normalizeSubjectFromDedicatedColumn(subjectRaw)
      const courseFromColumn = normalizeCourseNumber(courseNumberRaw)

      if (subjectFromColumn.normalized && courseFromColumn) {
        extracted = {
          subject_code: subjectFromColumn.normalized,
          course_number: courseFromColumn,
        }

        if (subjectFromColumn.hadSpacesRemoved) {
          const transformKey = `${subjectFromColumn.collapsed} -> ${subjectFromColumn.normalized}`
          stats.subject_space_transforms[transformKey] = (stats.subject_space_transforms[transformKey] ?? 0) + 1
          if (!legacyCombinedExtraction) {
            stats.recovered_rows_due_to_subject_space_normalization += 1
          }
        }
      }
    }

    if (!extracted && normalizeWhitespace(combinedRaw)) {
      extracted = parseCourseToken(combinedRaw)
    }

    if (!extracted) {
      const scanCandidates = [subjectRaw, courseNumberRaw, combinedRaw, row.join(' ')]
      for (const candidate of scanCandidates) {
        extracted = parseCourseToken(candidate)
        if (extracted) break
      }
    }

    if (!extracted) {
      const rejected = {
      institution,
      institution_key: institutionKey,
      source_file: path.relative(ROOT, inputPath),
      source_row_number: rowNumber,
      reason: 'could_not_extract_subject_code_and_course_number',
        raw_row: rowObject,
      }
      rejectedWriter.write(`${JSON.stringify(rejected)}\n`)
      stats.rejected_rows += 1
      continue
    }

    const titleRaw = mapping.title >= 0 ? normalizeWhitespace(row[mapping.title]) : ''
    const descriptionRaw = mapping.description >= 0 ? normalizeWhitespace(row[mapping.description]) : ''

    const normalized = {
      institution,
      institution_key: institutionKey,
      subject_code: extracted.subject_code,
      course_number: extracted.course_number,
      title: titleRaw || null,
      description: descriptionRaw || null,
      source_file: path.relative(ROOT, inputPath),
      source_row_number: rowNumber,
      dedupe_key: `${institutionKey}:${extracted.subject_code}:${extracted.course_number}`,
      raw_row: rowObject,
    }

    outputWriter.write(`${JSON.stringify(normalized)}\n`)
    acceptedRows.push(normalized)
    stats.accepted_rows += 1
  }

  await new Promise((resolve) => outputWriter.end(resolve))
  return { stats, acceptedRows }
}

function ensureInvariants(statsByInstitution) {
  for (const stats of statsByInstitution) {
    if (stats.processed_rows !== stats.accepted_rows + stats.rejected_rows) {
      throw new Error(
        `Row accounting mismatch for ${stats.institution}: processed=${stats.processed_rows} accepted=${stats.accepted_rows} rejected=${stats.rejected_rows}`
      )
    }
  }
}

async function runImport() {
  await fsp.mkdir(OUTPUT_DIR, { recursive: true })
  await fsp.mkdir(path.dirname(AUDIT_PATH), { recursive: true })

  const categoryMapRaw = JSON.parse(await fsp.readFile(CATEGORY_MAP_PATH, 'utf8'))
  const subjectToCategory = categoryMapRaw.subject_to_category ?? {}
  const defaultCategory = categoryMapRaw.default_category ?? 'Other'

  const rejectedWriter = fs.createWriteStream(REJECTED_PATH, { encoding: 'utf8' })
  const statsByInstitution = []
  const allAcceptedRows = []

  for (const input of INPUTS) {
    const result = await processCsv(input, rejectedWriter)
    statsByInstitution.push(result.stats)
    allAcceptedRows.push(...result.acceptedRows)
  }

  await new Promise((resolve) => rejectedWriter.end(resolve))

  ensureInvariants(statsByInstitution)

  const byKey = new Map()
  let duplicateRowsEncountered = 0
  let replacedPreferredRowCount = 0

  for (const row of allAcceptedRows) {
    const key = row.dedupe_key
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, row)
      continue
    }

    duplicateRowsEncountered += 1
    if (isPreferredCandidate(row, existing)) {
      byKey.set(key, row)
      replacedPreferredRowCount += 1
    }
  }

  const dedupedRows = Array.from(byKey.values()).map((row) => {
    const category = subjectToCategory[row.subject_code] ?? defaultCategory
    return {
      institution: row.institution,
      institution_key: row.institution_key,
      subject_code: row.subject_code,
      course_number: row.course_number,
      title: row.title,
      description: row.description,
      category,
      dedupe_key: row.dedupe_key,
      source_file: row.source_file,
      source_row_number: row.source_row_number,
    }
  })

  sortCombinedRows(dedupedRows)

  const combinedOutput = {
    generated_at: new Date().toISOString(),
    total_courses: dedupedRows.length,
    duplicate_rows_encountered: duplicateRowsEncountered,
    replaced_preferred_row_count: replacedPreferredRowCount,
    courses: dedupedRows,
  }

  await fsp.writeFile(COMBINED_PATH, `${JSON.stringify(combinedOutput, null, 2)}\n`, 'utf8')

  const canonicalCourses = dedupedRows.map((row) => ({
    institution: row.institution,
    institution_key: row.institution_key,
    subject_code: row.subject_code,
    course_number: row.course_number,
    title: row.title,
    description: row.description,
    category: row.category,
    slug: slugify(`${institutionSlug(row.institution)}-${row.subject_code}-${row.course_number}`),
  }))

  await fsp.writeFile(
    CANONICAL_PATH,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_courses: canonicalCourses.length,
        courses: canonicalCourses,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  const unknownSubjects = {}
  for (const row of dedupedRows) {
    if (row.category !== defaultCategory) continue
    unknownSubjects[row.subject_code] = (unknownSubjects[row.subject_code] ?? 0) + 1
  }

  const mergedTransforms = {}
  let recoveredRowsDueToSubjectSpaceNormalization = 0
  for (const stats of statsByInstitution) {
    recoveredRowsDueToSubjectSpaceNormalization += stats.recovered_rows_due_to_subject_space_normalization ?? 0
    for (const [transformKey, count] of Object.entries(stats.subject_space_transforms ?? {})) {
      mergedTransforms[transformKey] = (mergedTransforms[transformKey] ?? 0) + count
    }
  }

  const auditLines = []
  auditLines.push('# Course CSV Import Audit')
  auditLines.push('')
  auditLines.push(`Generated: ${new Date().toISOString()}`)
  auditLines.push('')
  auditLines.push('## Inputs')
  auditLines.push('')
  for (const input of INPUTS) {
    auditLines.push(`- ${path.relative(ROOT, input.inputPath)}`)
  }
  auditLines.push('')
  auditLines.push('## Parsing & Normalization Counts')
  auditLines.push('')
  for (const stats of statsByInstitution) {
    auditLines.push(`### ${stats.institution}`)
    auditLines.push('')
    auditLines.push(`- processed_rows: ${stats.processed_rows}`)
    auditLines.push(`- accepted_rows: ${stats.accepted_rows}`)
    auditLines.push(`- rejected_rows: ${stats.rejected_rows}`)
    auditLines.push(
      `- recovered_rows_due_to_subject_space_normalization: ${stats.recovered_rows_due_to_subject_space_normalization}`
    )
    auditLines.push(`- row_accounting_check: ${stats.processed_rows === stats.accepted_rows + stats.rejected_rows ? 'pass' : 'fail'}`)
    auditLines.push('')
  }

  auditLines.push('## Dedupe Rules Applied')
  auditLines.push('')
  auditLines.push('- Dedupe key: institution + ":" + subject_code + ":" + course_number')
  auditLines.push('- Preference: non-empty title first, then longer description, then deterministic source tie-break')
  auditLines.push(`- duplicate_rows_encountered: ${duplicateRowsEncountered}`)
  auditLines.push(`- replaced_preferred_row_count: ${replacedPreferredRowCount}`)
  auditLines.push(`- deduped_total_courses: ${dedupedRows.length}`)
  auditLines.push('')

  auditLines.push('## Subject Code Space-Removal Transforms')
  auditLines.push('')
  auditLines.push(`- recovered_rows_due_to_subject_space_normalization_total: ${recoveredRowsDueToSubjectSpaceNormalization}`)
  const topTransforms = Object.entries(mergedTransforms)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
  if (topTransforms.length === 0) {
    auditLines.push('- None')
  } else {
    for (const [transform, count] of topTransforms) {
      auditLines.push(`- ${transform}: ${count}`)
    }
  }
  auditLines.push('')

  auditLines.push('## Unknown Subject Codes Mapped To Other')
  auditLines.push('')
  const unknownEntries = Object.entries(unknownSubjects).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (unknownEntries.length === 0) {
    auditLines.push('- None')
  } else {
    for (const [subject, count] of unknownEntries) {
      auditLines.push(`- ${subject}: ${count}`)
    }
  }

  auditLines.push('')
  auditLines.push('## Output Files')
  auditLines.push('')
  for (const input of INPUTS) {
    auditLines.push(`- ${path.relative(ROOT, input.outputPath)}`)
  }
  auditLines.push(`- ${path.relative(ROOT, REJECTED_PATH)}`)
  auditLines.push(`- ${path.relative(ROOT, COMBINED_PATH)}`)
  auditLines.push(`- ${path.relative(ROOT, CANONICAL_PATH)}`)

  await fsp.writeFile(AUDIT_PATH, `${auditLines.join('\n')}\n`, 'utf8')

  const rejectedTotal = statsByInstitution.reduce((sum, s) => sum + s.rejected_rows, 0)
  console.log(`[import-course-csvs] wrote ${path.relative(ROOT, COMBINED_PATH)}`)
  console.log(`[import-course-csvs] wrote ${path.relative(ROOT, CANONICAL_PATH)}`)
  console.log(`[import-course-csvs] wrote ${path.relative(ROOT, REJECTED_PATH)}`)
  console.log(`[import-course-csvs] combined_total=${dedupedRows.length} rejected_total=${rejectedTotal}`)

  return {
    combinedTotal: dedupedRows.length,
    rejectedTotal,
    duplicateRowsEncountered,
    statsByInstitution,
  }
}

async function verifyOutputs() {
  const [combinedRaw, canonicalRaw, rejectedRaw] = await Promise.all([
    fsp.readFile(COMBINED_PATH, 'utf8'),
    fsp.readFile(CANONICAL_PATH, 'utf8'),
    fsp.readFile(REJECTED_PATH, 'utf8'),
  ])

  const combined = JSON.parse(combinedRaw)
  const canonical = JSON.parse(canonicalRaw)

  if (!Array.isArray(combined.courses) || !Array.isArray(canonical.courses)) {
    throw new Error('Combined/canonical outputs are malformed arrays.')
  }

  if (combined.courses.length !== canonical.courses.length) {
    throw new Error('Combined and canonical course counts differ.')
  }

  const seen = new Set()
  for (let i = 0; i < combined.courses.length; i += 1) {
    const row = combined.courses[i]
    const key = `${row.institution_key}:${row.subject_code}:${row.course_number}`
    if (seen.has(key)) throw new Error(`Duplicate dedupe key remains after dedupe: ${key}`)
    seen.add(key)

    if (i > 0) {
      const prev = combined.courses[i - 1]
      const cmpInstitution = prev.institution.localeCompare(row.institution)
      const cmpSubject = prev.subject_code.localeCompare(row.subject_code)
      const cmpCourse = compareCourseNumber(prev.course_number, row.course_number)
      const isOutOfOrder =
        cmpInstitution > 0 ||
        (cmpInstitution === 0 && cmpSubject > 0) ||
        (cmpInstitution === 0 && cmpSubject === 0 && cmpCourse > 0)
      if (isOutOfOrder) {
        throw new Error(`Combined output not deterministically sorted at index ${i}`)
      }
    }
  }

  const rejectedLines = rejectedRaw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of rejectedLines) {
    const row = JSON.parse(line)
    if (!row.reason || !row.raw_row) {
      throw new Error('Rejected row missing reason/raw_row.')
    }
  }

  console.log(
    `[import-course-csvs:verify] ok combined_total=${combined.courses.length} rejected_total=${rejectedLines.length}`
  )
}

if (VERIFY_ONLY) {
  await verifyOutputs()
} else {
  await runImport()
}
