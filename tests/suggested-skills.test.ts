import assert from 'node:assert/strict'
import test from 'node:test'
import { suggestSkillsForListing } from '../lib/skills/suggestedSkills.ts'

test('suggestSkillsForListing returns finance/accounting suggestions with catalog matching', () => {
  const suggestions = suggestSkillsForListing({
    title: 'Accounting Intern',
    category: 'Accounting',
    courseworkCategoryLabels: ['Financial Accounting'],
    selectedSkillLabels: ['Excel'],
    catalogLabels: ['Excel', 'GAAP', 'Reconciliations', 'QuickBooks', 'Accounts Payable', 'Accounts Receivable'],
  })

  assert.equal(suggestions.includes('Excel'), false)
  assert.equal(suggestions.includes('GAAP'), true)
  assert.equal(suggestions.includes('QuickBooks'), true)
})
