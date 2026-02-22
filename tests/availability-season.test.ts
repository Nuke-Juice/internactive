import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeListingSeasons,
  normalizeSeason,
  normalizePreferredSeasons,
  normalizeSeasonsFromValue,
} from '../lib/availability/normalizeSeason.ts'
import { seasonOverlap } from '../lib/availability/seasonOverlap.ts'
import { evaluateInternshipMatch } from '../lib/matching.ts'

test('normalizeSeasonsFromValue maps March-June range to spring + summer', () => {
  const seasons = normalizeSeasonsFromValue('March 2026 - June 2026')
  assert.deepEqual(seasons, ['spring', 'summer'])
})

test('normalizeSeasonsFromValue maps May-Aug to summer', () => {
  const seasons = normalizeSeasonsFromValue('May 2026 - August 2026')
  assert.deepEqual(seasons, ['summer'])
})

test('season overlap reports partial overlap and coverage', () => {
  const overlap = seasonOverlap({
    studentSeasons: ['summer'],
    listingSeasons: ['spring', 'summer'],
  })
  assert.equal(overlap.hasOverlap, true)
  assert.deepEqual(overlap.overlapSeasons, ['summer'])
  assert.equal(overlap.listingCoverage, 0.5)
})

test('season fallback still computes term signal when start month is missing', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'internship-range-overlap',
      majors: ['finance'],
      term: 'March 2026 - June 2026',
    },
    {
      majors: ['finance'],
      preferred_terms: ['summer'],
    },
    undefined,
    { explain: true }
  )
  assert.equal(match.eligible, true)
  assert.ok(match.gaps.some((gap) => gap.toLowerCase().includes('late start')))
  const termSignal = match.breakdown?.perSignalContributions.find((row) => row.signalKey === 'termAlignment')
  assert.ok(termSignal)
  assert.equal(termSignal?.rawMatchValue, 0.5)
})

test('normalizeSeason maps May to summer', () => {
  assert.equal(normalizeSeason('May'), 'summer')
})

test('normalizePreferredSeasons merges explicit preferences with availability month', () => {
  const seasons = normalizePreferredSeasons({
    preferredTerms: ['fall'],
    availabilityStartMonth: 'May',
  })
  assert.deepEqual(seasons, ['fall', 'summer'])
})

test('listing seasons fallback to start date when term is missing', () => {
  const seasons = normalizeListingSeasons({ term: null, startDate: '2026-05-15' })
  assert.deepEqual(seasons, ['summer'])
})

test('availability breakdown returns hours + start-date fit with deterministic category score', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'availability-breakdown',
      majors: ['finance'],
      hours_per_week: 25,
      term: 'March 2026 - June 2026',
    },
    {
      majors: ['finance'],
      preferred_terms: ['summer'],
      availability_start_month: 'May',
      availability_hours_per_week: 30,
    },
    undefined,
    { explain: true }
  )
  const availability = match.breakdown?.categories.find((category) => category.key === 'availability')
  assert.ok(availability?.availability_fit)
  assert.equal(availability?.availability_fit?.hours_fit.score, 6)
  assert.equal(availability?.availability_fit?.term_fit.score, 0.9)
  assert.equal(availability?.status, 'gap')
  assert.ok(match.gaps.some((gap) => gap.toLowerCase().includes('late start')))
})

test('student starting before listing gets full start-date points', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'start-before-listing',
      majors: ['finance'],
      start_date: '2026-03-01',
      hours_per_week: 20,
    },
    {
      majors: ['finance'],
      availability_start_month: 'February',
      availability_hours_per_week: 30,
    },
    undefined,
    { explain: true }
  )
  const availability = match.breakdown?.categories.find((category) => category.key === 'availability')
  assert.equal(availability?.availability_fit?.term_fit.score, 9)
  assert.equal(availability?.status, 'good')
})

test('student starting well after listing gets near-zero start-date points and strong gap', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'late-start-strong-gap',
      majors: ['finance'],
      term: 'March 2026 - June 2026',
      hours_per_week: 20,
    },
    {
      majors: ['finance'],
      availability_start_month: 'May',
      availability_hours_per_week: 25,
    },
    undefined,
    { explain: true }
  )
  const availability = match.breakdown?.categories.find((category) => category.key === 'availability')
  assert.equal(availability?.availability_fit?.term_fit.score, 0.9)
  assert.equal(availability?.status, 'gap')
  assert.ok(match.gaps.some((gap) => gap.toLowerCase().includes('late start')))
})

test('missing start month falls back to season and prompts user to set exact month', () => {
  const match = evaluateInternshipMatch(
    {
      id: 'fallback-season-only',
      majors: ['finance'],
      term: 'March 2026 - June 2026',
    },
    {
      majors: ['finance'],
      preferred_terms: ['summer'],
      availability_start_month: null,
    },
    undefined,
    { explain: true }
  )
  assert.ok(match.gaps.some((gap) => gap.toLowerCase().includes('late start')))
  assert.ok(
    match.breakdown?.perSignalContributions
      .find((row) => row.signalKey === 'startDateFit')
      ?.evidence.some((entry) => entry.includes('student_start_source=season_fallback'))
  )
})
