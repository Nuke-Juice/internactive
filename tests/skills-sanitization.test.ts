import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeSkillLabels } from '../lib/skills/sanitizeSkillLabels.ts'

test('sanitizeSkillLabels rejects degree/qualification phrases from skills', () => {
  const { valid, rejected } = sanitizeSkillLabels([
    'Excel',
    'Pursuing Finance degree',
    'currently pursuing accounting degree',
    'SQL',
  ])

  assert.deepEqual(valid, ['Excel', 'SQL'])
  assert.equal(rejected.length, 2)
  assert.equal(rejected.some((item) => item.toLowerCase().startsWith('pursuing')), true)
})

test('sanitizeSkillLabels dedupes case-insensitively and rejects overly long labels', () => {
  const { valid, rejected } = sanitizeSkillLabels([
    'Excel',
    ' excel ',
    'SQL',
    'S'.repeat(61),
  ])

  assert.deepEqual(valid, ['Excel', 'SQL'])
  assert.equal(rejected.length, 1)
})
