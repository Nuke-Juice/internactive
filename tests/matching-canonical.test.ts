import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateInternshipMatch } from '../lib/matching.ts'

test('canonical coursework overlap contributes to match score', () => {
  const withCanonical = evaluateInternshipMatch(
    {
      id: 'internship-1',
      majors: ['finance'],
      required_skill_ids: ['skill-a'],
      coursework_item_ids: ['cw-1', 'cw-2'],
      recommended_coursework: ['Corporate Finance'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a'],
      coursework_item_ids: ['cw-2'],
      coursework: [],
    }
  )

  const withoutCanonical = evaluateInternshipMatch(
    {
      id: 'internship-1',
      majors: ['finance'],
      required_skill_ids: ['skill-a'],
      coursework_item_ids: ['cw-1', 'cw-2'],
      recommended_coursework: ['Corporate Finance'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a'],
      coursework_item_ids: [],
      coursework: [],
    }
  )

  assert.ok(withCanonical.score > withoutCanonical.score)
  assert.ok(withCanonical.reasons.some((reason) => reason.toLowerCase().includes('recommended coursework')))
})

test('coursework category overlap is primary signal and reasons use categories', () => {
  const withCategoryOverlap = evaluateInternshipMatch(
    {
      id: 'internship-2',
      majors: ['finance'],
      required_skill_ids: ['skill-a'],
      coursework_category_ids: ['cat-corp-finance'],
      coursework_category_names: ['Corporate Finance / Valuation'],
      coursework_item_ids: ['course-a'],
      recommended_coursework: ['FIN 3400'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a'],
      coursework_category_ids: ['cat-corp-finance'],
      coursework_item_ids: [],
      coursework: ['BUS 460'],
    }
  )

  const noCategoryOverlap = evaluateInternshipMatch(
    {
      id: 'internship-2',
      majors: ['finance'],
      required_skill_ids: ['skill-a'],
      coursework_category_ids: ['cat-corp-finance'],
      coursework_category_names: ['Corporate Finance / Valuation'],
      coursework_item_ids: ['course-a'],
      recommended_coursework: ['FIN 3400'],
    },
    {
      majors: ['finance'],
      skill_ids: ['skill-a'],
      coursework_category_ids: [],
      coursework_item_ids: [],
      coursework: ['BUS 460'],
    }
  )

  assert.ok(withCategoryOverlap.score > noCategoryOverlap.score)
  assert.ok(withCategoryOverlap.reasons.some((reason) => reason.toLowerCase().includes('inferred categories match')))
  assert.ok(withCategoryOverlap.reasons.some((reason) => reason.toLowerCase().includes('corporate finance / valuation')))
})
