import type { Internship } from '@/lib/jobs/internships'

export function parseSponsoredInternshipIds(raw: string | undefined) {
  if (!raw) return []
  return Array.from(new Set(raw.split(',').map((item) => item.trim()).filter(Boolean)))
}

export function splitSponsoredListings(input: {
  sponsoredListings: Internship[]
  organicListings: Internship[]
  maxSponsored?: number
}) {
  const maxSponsored = typeof input.maxSponsored === 'number' ? Math.max(0, Math.trunc(input.maxSponsored)) : 3
  const sponsored = input.sponsoredListings.slice(0, maxSponsored)
  if (sponsored.length === 0) return { sponsored: [] as Internship[], organic: input.organicListings }

  const sponsoredIds = new Set(sponsored.map((listing) => listing.id))
  const organic = input.organicListings.filter((listing) => !sponsoredIds.has(listing.id))
  return { sponsored, organic }
}
