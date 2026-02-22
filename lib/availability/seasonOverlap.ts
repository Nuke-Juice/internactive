import type { CanonicalSeason } from '@/lib/availability/normalizeSeason'

export type SeasonOverlap = {
  hasOverlap: boolean
  overlapSeasons: CanonicalSeason[]
  mismatchSeasons: CanonicalSeason[]
  listingCoverage: number
}

const ORDER: CanonicalSeason[] = ['spring', 'summer', 'fall', 'winter']

export function seasonOverlap(params: {
  studentSeasons: CanonicalSeason[]
  listingSeasons: CanonicalSeason[]
}): SeasonOverlap {
  const student = Array.from(new Set(params.studentSeasons))
  const listing = Array.from(new Set(params.listingSeasons))
  const studentSet = new Set(student)
  const overlapSeasons = ORDER.filter((season) => listing.includes(season) && studentSet.has(season))
  const mismatchSeasons = ORDER.filter((season) => listing.includes(season) && !studentSet.has(season))
  const listingCoverage = listing.length > 0 ? overlapSeasons.length / listing.length : 0

  return {
    hasOverlap: overlapSeasons.length > 0,
    overlapSeasons,
    mismatchSeasons,
    listingCoverage,
  }
}
