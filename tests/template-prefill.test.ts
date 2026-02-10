import assert from 'node:assert/strict'
import test from 'node:test'
import { INTERNSHIP_TEMPLATES } from '../lib/admin/internshipTemplates.ts'

function normalize(value: string) {
  return value.trim().toLowerCase()
}

test('templates keep responsibilities/qualifications/skills in distinct buckets', () => {
  for (const template of INTERNSHIP_TEMPLATES) {
    const responsibilities = template.responsibilities.map(normalize)
    const qualifications = template.qualifications.map(normalize)
    const requiredSkills = template.required_skills.map(normalize)
    const preferredSkills = template.preferred_skills.map(normalize)

    for (const required of requiredSkills) {
      assert.equal(
        responsibilities.includes(required),
        false,
        `${template.key}: required skill appears in responsibilities (${required})`
      )
      assert.equal(
        qualifications.includes(required),
        false,
        `${template.key}: required skill appears in qualifications (${required})`
      )
      assert.equal(
        required.startsWith('pursuing '),
        false,
        `${template.key}: qualification text leaked into required skills (${required})`
      )
      assert.equal(
        required.includes(' degree'),
        false,
        `${template.key}: degree requirement leaked into required skills (${required})`
      )
    }

    for (const preferred of preferredSkills) {
      assert.equal(
        responsibilities.includes(preferred),
        false,
        `${template.key}: preferred skill appears in responsibilities (${preferred})`
      )
      assert.equal(
        qualifications.includes(preferred),
        false,
        `${template.key}: preferred skill appears in qualifications (${preferred})`
      )
      assert.equal(
        preferred.startsWith('pursuing '),
        false,
        `${template.key}: qualification text leaked into preferred skills (${preferred})`
      )
      assert.equal(
        preferred.includes(' degree'),
        false,
        `${template.key}: degree requirement leaked into preferred skills (${preferred})`
      )
    }

    assert.equal(template.description.length > 0, true, `${template.key}: missing description`)
    assert.equal(template.recommended_coursework_categories.length > 0, true, `${template.key}: missing coursework categories`)
  }
})
