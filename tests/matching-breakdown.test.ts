import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_MATCHING_WEIGHTS, evaluateInternshipMatch } from '../lib/matching.ts'
import { mockInternships, mockStudents } from '../lib/matching.fixtures.ts'
import { expectedSignalKeys, rankInternshipsForStudentPreview, evaluateSinglePreviewMatch } from '../lib/admin/matchingPreview.ts'

test('explain breakdown includes expected signals and raw contributions sum to raw total', () => {
  const match = evaluateInternshipMatch(mockInternships[0], mockStudents[0].profile, DEFAULT_MATCHING_WEIGHTS, {
    explain: true,
  })
  assert.ok(match.breakdown)

  const expectedKeys = expectedSignalKeys()
  const contributionKeys = (match.breakdown?.perSignalContributions ?? []).map((row) => row.signalKey)
  assert.deepEqual(contributionKeys, expectedKeys)

  const contributionTotal = (match.breakdown?.perSignalContributions ?? []).reduce((sum, row) => sum + row.pointsAwarded, 0)
  assert.equal(Number(contributionTotal.toFixed(3)), Number((match.breakdown?.totalScoreRaw ?? 0).toFixed(3)))
  assert.equal(match.score, Math.round((match.breakdown?.normalizedScore ?? 0) * 100))

  const categoryTotal = (match.breakdown?.categories ?? []).reduce((sum, row) => sum + row.earned_points, 0)
  assert.equal(Number(categoryTotal.toFixed(1)), Number((match.breakdown?.total_score ?? 0).toFixed(1)))
  assert.equal(match.score, Math.round(match.breakdown?.total_score ?? 0))
  assert.equal(
    (match.breakdown?.categories ?? []).reduce((sum, row) => sum + row.weight_points, 0),
    100
  )
})

test('preview ranking score matches direct production score for same student/internship', () => {
  const internship = {
    id: mockInternships[0].id,
    title: mockInternships[0].title ?? null,
    companyName: 'Test Employer',
    category: 'Finance',
    roleCategory: 'Finance',
    experienceLevel: mockInternships[0].experience_level ?? null,
    location: mockInternships[0].location ?? null,
    workMode: mockInternships[0].work_mode ?? null,
    term: mockInternships[0].term ?? null,
    requiredSkills: mockInternships[0].required_skills ?? [],
    preferredSkills: mockInternships[0].preferred_skills ?? [],
    recommendedCoursework: mockInternships[0].recommended_coursework ?? [],
    majors: Array.isArray(mockInternships[0].majors) ? mockInternships[0].majors : [],
    targetGraduationYears: Array.isArray(mockInternships[0].target_graduation_years)
      ? mockInternships[0].target_graduation_years
      : [],
    hoursPerWeek: mockInternships[0].hours_per_week ?? null,
    coverage: {
      totalDimensions: 8,
      presentDimensions: 8,
      missingDimensions: [],
    },
    matchInput: mockInternships[0],
  }

  const ranked = rankInternshipsForStudentPreview([internship], mockStudents[0].profile)
  assert.equal(ranked.length, 1)

  const direct = evaluateSinglePreviewMatch(internship, mockStudents[0].profile)
  assert.equal(ranked[0].match.score, direct.score)
})
