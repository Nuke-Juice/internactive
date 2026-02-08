export type InternshipMatchInput = {
  majors: string[] | string | null
  hoursPerWeek: number | null
  createdAt: string | null
}

export type StudentMatchProfile = {
  majors: string[]
  availabilityHoursPerWeek: number | null
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

export function parseMajors(value: string[] | string | null | undefined) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }

  return value
    .split(',')
    .map(normalizeText)
    .filter(Boolean)
}

export function calculateMatchScore(
  internship: InternshipMatchInput,
  profile: StudentMatchProfile
) {
  let score = 0
  const profileMajors = profile.majors.map(normalizeText)
  const listingMajors = parseMajors(internship.majors)

  if (listingMajors.length > 0 && profileMajors.length > 0) {
    const hasMajorMatch = listingMajors.some((major) => profileMajors.includes(major))
    if (hasMajorMatch) score += 2
  }

  if (
    typeof internship.hoursPerWeek === 'number' &&
    typeof profile.availabilityHoursPerWeek === 'number'
  ) {
    const diff = Math.abs(internship.hoursPerWeek - profile.availabilityHoursPerWeek)
    if (diff <= 5) score += 1
  }

  return score
}
