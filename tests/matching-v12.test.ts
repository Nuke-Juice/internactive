import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateInternshipMatch,
  parseMajors,
  rankInternships,
  type InternshipMatchInput,
  type StudentMatchProfile,
} from '../lib/matching.ts'
import { buildApplicationMatchSnapshot } from '../lib/applicationMatchSnapshot.ts'
import { splitSponsoredListings } from '../lib/jobs/sponsored.ts'

test('work mode normalization recognizes in_person aliases', () => {
  const majors = parseMajors(['Computer Science'])
  assert.deepEqual(majors, ['computer science'])

  const baseProfile: StudentMatchProfile = { majors: ['computer science'], remote_only: true }
  const onSite = evaluateInternshipMatch({ id: 'i1', majors: ['computer science'], work_mode: 'on-site' }, baseProfile)
  const inPerson = evaluateInternshipMatch({ id: 'i2', majors: ['computer science'], work_mode: 'in_person' }, baseProfile)
  assert.equal(onSite.eligible, false)
  assert.equal(inPerson.eligible, false)
})

test('preferred work mode mismatch applies soft penalty and stays eligible', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['computer science'],
      work_mode: 'in_person',
    },
    {
      majors: ['computer science'],
      preferred_work_modes: ['remote'],
      remote_only: false,
    }
  )
  assert.equal(result.eligible, true)
  assert.ok(result.gaps.some((gap) => gap.toLowerCase().includes('work mode mismatch')))
})

test('term mismatch applies soft penalty and stays eligible', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['finance'],
      term: 'Summer 2026',
    },
    {
      majors: ['finance'],
      preferred_terms: ['fall'],
    }
  )
  assert.equal(result.eligible, true)
  assert.ok(result.gaps.some((gap) => gap.toLowerCase().includes('term mismatch')))
})

test('remote_only still excludes non-remote internships', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['finance'],
      work_mode: 'hybrid',
    },
    {
      majors: ['finance'],
      remote_only: true,
    }
  )
  assert.equal(result.eligible, false)
})

test('start date mismatch adds penalty gap', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['finance'],
      start_date: '2026-01-01',
    },
    {
      majors: ['finance'],
      availability_start_month: 'May',
    }
  )
  assert.equal(result.eligible, true)
  assert.ok(result.gaps.some((gap) => gap.toLowerCase().includes("start before you're available")))
})

test('match snapshot stores 0-100 score', () => {
  const snapshot = buildApplicationMatchSnapshot({
    internship: {
      id: 'i1',
      majors: ['finance'],
      work_mode: 'remote',
    },
    profile: {
      majors: ['finance'],
      availability_start_month: 'May',
    },
  })
  assert.ok(Number.isInteger(snapshot.match_score))
  assert.ok(snapshot.match_score >= 0 && snapshot.match_score <= 100)
})

test('reasons are capped to 3', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['finance', 'economics'],
      required_skills: ['excel', 'sql', 'python'],
      preferred_skills: ['tableau', 'powerpoint'],
      recommended_coursework: ['finance', 'econometrics'],
      work_mode: 'remote',
      term: 'fall',
    },
    {
      majors: ['finance', 'economics'],
      skills: ['excel', 'sql', 'python', 'tableau', 'powerpoint'],
      coursework: ['finance', 'econometrics'],
      preferred_terms: ['fall'],
      preferred_work_modes: ['remote'],
      availability_hours_per_week: 20,
    }
  )
  assert.ok(result.reasons.length <= 3)
})

test('gaps are capped to 2', () => {
  const result = evaluateInternshipMatch(
    {
      id: 'i1',
      majors: ['finance'],
      required_skills: ['excel', 'sql', 'python'],
      preferred_skills: ['tableau'],
      term: 'summer',
      work_mode: 'in_person',
      location: 'New York, NY',
      start_date: '2026-01-01',
    },
    {
      majors: ['biology'],
      skills: ['excel'],
      preferred_work_modes: ['remote'],
      preferred_locations: ['boston'],
      preferred_terms: ['fall'],
      availability_start_month: 'May',
    }
  )
  assert.ok(result.gaps.length <= 2)
})

test('best match tie-break does not use employer tier', () => {
  const internships: InternshipMatchInput[] = [
    { id: 'b', majors: ['finance'], created_at: '2026-02-01T00:00:00.000Z' },
    { id: 'a', majors: ['finance'], created_at: '2026-02-01T00:00:00.000Z' },
  ]
  const ranked = rankInternships(internships, { majors: ['finance'] })
  assert.deepEqual(ranked.map((item) => item.internship.id), ['a', 'b'])
})

test('sponsored listings are separated and deduped from organic', () => {
  const sponsored = [
    { id: 's1' },
    { id: 's2' },
  ] as unknown as Array<Parameters<typeof splitSponsoredListings>[0]['sponsoredListings'][number]>
  const organic = [
    { id: 'o1' },
    { id: 's1' },
    { id: 'o2' },
  ] as unknown as Array<Parameters<typeof splitSponsoredListings>[0]['organicListings'][number]>

  const split = splitSponsoredListings({ sponsoredListings: sponsored, organicListings: organic, maxSponsored: 3 })
  assert.deepEqual(split.sponsored.map((row) => row.id), ['s1', 's2'])
  assert.deepEqual(split.organic.map((row) => row.id), ['o1', 'o2'])
})
