import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeListingCoursework } from '../lib/coursework/normalizeListingCoursework.ts'
import { getStudentCourseworkFeatures } from '../lib/coursework/getStudentCourseworkFeatures.ts'
import { evaluateInternshipMatch } from '../lib/matching.ts'

function createSupabaseStub(tableData) {
  return {
    from(table) {
      const state = { table }
      const builder = {
        select() {
          return builder
        },
        eq() {
          return builder
        },
        in() {
          return builder
        },
        limit() {
          return builder
        },
        then(onFulfilled, onRejected) {
          return Promise.resolve({ data: tableData[state.table] ?? [], error: null }).then(onFulfilled, onRejected)
        },
      }
      return builder
    },
  }
}

test('normalizeListingCoursework merges canonical and legacy requirement models', () => {
  const normalized = normalizeListingCoursework({
    internship_required_course_categories: [
      { category_id: 'canon-1', category: { name: 'Finance & Accounting' } },
      { category_id: 'canon-1', category: { name: 'Finance & Accounting' } },
    ],
    internship_coursework_category_links: [
      { category_id: 'legacy-cat-1', category: { name: 'Corporate Finance / Valuation' } },
    ],
    internship_coursework_items: [
      { coursework_item_id: 'legacy-item-1', coursework: { name: 'FIN 3400' } },
    ],
  })

  assert.deepEqual(normalized.requiredCanonicalCategoryIds, ['canon-1'])
  assert.deepEqual(normalized.requiredCanonicalCategoryNames, ['Finance & Accounting'])
  assert.deepEqual(normalized.legacyCategoryIds, ['legacy-cat-1'])
  assert.deepEqual(normalized.legacyItemIds, ['legacy-item-1'])
  assert.equal(normalized.hasAnyCourseworkRequirement, true)
})

test('getStudentCourseworkFeatures derives canonical, legacy, and text coverage', async () => {
  const supabase = createSupabaseStub({
    student_courses: [
      {
        student_profile_id: 'student-1',
        course: {
          category_id: 'cat-software',
          subject_code: 'CS',
          course_number: '3500',
          level: 'advanced',
          category: { id: 'cat-software', name: 'Software Engineering' },
        },
      },
      {
        student_profile_id: 'student-1',
        course: {
          category_id: null,
          subject_code: 'ACCTG',
          course_number: '201',
          level: null,
          category: null,
        },
      },
    ],
    canonical_course_categories: [
      { id: 'cat-finance', name: 'Finance & Accounting', slug: 'finance-accounting' },
    ],
    student_coursework_category_links: [{ student_id: 'student-1', category_id: 'legacy-cat' }],
    student_coursework_items: [{ student_id: 'student-1', coursework_item_id: 'legacy-item' }],
    student_profiles: [{ coursework: ['ACCTG 2010'], coursework_unverified: ['Custom Elective'] }],
  })

  const features = await getStudentCourseworkFeatures({
    supabase: supabase,
    studentId: 'student-1',
  })

  assert.equal(features.coverage.hasCanonical, true)
  assert.equal(features.coverage.hasLegacy, true)
  assert.equal(features.coverage.hasText, true)
  assert.ok(features.canonicalCategoryIds.includes('cat-software'))
  assert.ok(features.canonicalCategoryIds.includes('cat-finance'))
  assert.ok(features.canonicalCourseLevelBands.includes('advanced'))
})

test('matching uses canonical requirements first and reports missing canonical coverage', () => {
  const noCanonicalStudent = evaluateInternshipMatch(
    {
      id: 'listing-1',
      majors: ['finance'],
      required_course_category_ids: ['canon-fin'],
      required_course_category_names: ['Finance & Accounting'],
      coursework_category_ids: ['legacy-cat'],
      coursework_category_names: ['Corporate Finance'],
      desired_coursework_strength: 'high',
    },
    {
      majors: ['finance'],
      coursework_category_ids: ['legacy-cat'],
      coursework: ['corporate finance'],
    }
  )

  const canonicalStudent = evaluateInternshipMatch(
    {
      id: 'listing-1',
      majors: ['finance'],
      required_course_category_ids: ['canon-fin'],
      required_course_category_names: ['Finance & Accounting'],
      coursework_category_ids: ['legacy-cat'],
      coursework_category_names: ['Corporate Finance'],
      desired_coursework_strength: 'high',
    },
    {
      majors: ['finance'],
      canonical_coursework_category_ids: ['canon-fin'],
      canonical_coursework_category_names: ['Finance & Accounting'],
      canonical_coursework_level_bands: ['advanced'],
      coursework_category_ids: ['legacy-cat'],
      coursework: ['corporate finance'],
    }
  )

  assert.equal(noCanonicalStudent.courseworkSignalPathUsed, 'canonical')
  assert.ok(noCanonicalStudent.gaps.some((gap) => gap.toLowerCase().includes('add courses to improve matching')))
  assert.equal(canonicalStudent.courseworkSignalPathUsed, 'canonical')
  assert.ok(canonicalStudent.score > noCanonicalStudent.score)
  assert.ok(canonicalStudent.reasons.some((reason) => reason.toLowerCase().includes('inferred categories match')))
})

test('legacy coursework listings still score via legacy path', () => {
  const legacyMatch = evaluateInternshipMatch(
    {
      id: 'listing-legacy',
      majors: ['computer science'],
      coursework_category_ids: ['legacy-se'],
      coursework_category_names: ['Software Engineering Fundamentals'],
    },
    {
      majors: ['computer science'],
      coursework_category_ids: ['legacy-se'],
    }
  )

  assert.equal(legacyMatch.courseworkSignalPathUsed, 'legacy')
  assert.ok(legacyMatch.score > 0)
})

test('subject-prefix coursework derivation infers accounting and finance categories from student courses', async () => {
  const supabase = createSupabaseStub({
    student_courses: [
      {
        student_profile_id: 'student-2',
        course: { category_id: null, subject_code: 'ACCTG', course_number: '2100', level: null, category: null },
      },
      {
        student_profile_id: 'student-2',
        course: { category_id: null, subject_code: 'FINAN', course_number: '2020', level: null, category: null },
      },
    ],
    canonical_course_categories: [{ id: 'cat-business-core', name: 'Business Core', slug: 'finance-accounting' }],
    student_coursework_category_links: [],
    student_coursework_items: [],
    student_profiles: [{ coursework: ['ACCTG 2100', 'FINAN 2020'], coursework_unverified: [] }],
  })

  const features = await getStudentCourseworkFeatures({
    supabase: supabase,
    studentId: 'student-2',
  })

  assert.ok(features.canonicalCategoryIds.includes('cat-business-core'))
  assert.ok(features.canonicalCategoryNames.includes('Business Core'))

  const match = evaluateInternshipMatch(
    {
      id: 'listing-business-core',
      majors: ['finance'],
      required_course_category_ids: ['cat-business-core'],
      required_course_category_names: ['Business Core'],
    },
    {
      majors: ['finance'],
      canonical_coursework_category_ids: features.canonicalCategoryIds,
      canonical_coursework_category_names: features.canonicalCategoryNames,
    }
  )
  assert.ok(match.reasons.some((reason) => reason.toLowerCase().includes('inferred categories match')))
})

test('empty student coursework stays neutral in category status and prompts to add courses', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'listing-empty-student',
      majors: ['finance'],
      required_course_category_ids: ['cat-business-core'],
      required_course_category_names: ['Business Core'],
    },
    {
      majors: ['finance'],
      canonical_coursework_category_ids: [],
      canonical_coursework_category_names: [],
      coursework_category_ids: [],
      coursework_item_ids: [],
      coursework: [],
    },
    undefined,
    { explain: true }
  )

  const courseworkCategory = match.breakdown?.categories.find((category) => category.key === 'coursework')
  assert.equal(courseworkCategory?.status, 'unknown')
  assert.ok(match.gaps.some((gap) => gap.toLowerCase().includes('add courses to improve matching')))
})
