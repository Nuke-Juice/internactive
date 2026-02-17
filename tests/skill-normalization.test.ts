import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateInternshipMatch } from '../lib/matching.ts'
import { normalizeSkillForMatching, normalizeSkillListForMatching } from '../lib/skills/normalizeForMatching.ts'

test('normalizeSkillForMatching maps common aliases to canonical tokens', () => {
  assert.equal(normalizeSkillForMatching(' Microsoft Excel '), 'excel')
  assert.equal(normalizeSkillForMatching('ms excel'), 'excel')
  assert.equal(normalizeSkillForMatching('communication skills'), 'communication')
  assert.equal(normalizeSkillForMatching('Written communication'), 'communication')
})

test('normalizeSkillListForMatching deduplicates normalized aliases', () => {
  const normalized = normalizeSkillListForMatching(['Excel', 'microsoft excel', 'MS EXCEL', 'attention to detail'])
  assert.deepEqual(normalized, ['excel', 'attention to detail'])
})

test('required text skills match normalized student skill aliases', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'internship-1',
      majors: ['finance'],
      required_skills: ['excel', 'attention to detail'],
    },
    {
      majors: ['finance'],
      skills: ['Microsoft Excel', 'Attention to Detail'],
    }
  )

  assert.equal(result.gaps.some((gap) => gap.toLowerCase().includes('missing required skills')), false)
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes('required skills')))
  assert.ok(result.score > 0)
})

