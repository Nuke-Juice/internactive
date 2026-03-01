export type StudentCourseworkCoverage = {
  hasCourseworkEntries: boolean
  hasCourseworkCategories: boolean
  inferencePending: boolean
  missing: boolean
}

export function resolveStudentCourseworkCoverage(input: {
  courseworkEntryCount: number
  courseworkCategoryCount: number
}) {
  const hasCourseworkEntries = input.courseworkEntryCount > 0
  const hasCourseworkCategories = input.courseworkCategoryCount > 0

  return {
    hasCourseworkEntries,
    hasCourseworkCategories,
    inferencePending: hasCourseworkEntries && !hasCourseworkCategories,
    missing: !hasCourseworkEntries && !hasCourseworkCategories,
  } satisfies StudentCourseworkCoverage
}

export function buildStudentCoverage(params: {
  majors: string[]
  year: string | null
  experienceLevel: string | null
  preferredTerms: string[]
  availabilityHours: number | null
  preferredLocations: string[]
  preferredWorkModes: string[]
  skillCount: number
  courseworkEntryCount: number
  courseworkCategoryCount: number
}) {
  const coursework = resolveStudentCourseworkCoverage({
    courseworkEntryCount: params.courseworkEntryCount,
    courseworkCategoryCount: params.courseworkCategoryCount,
  })

  const checks = [
    ['majors', params.majors.length > 0],
    ['skills', params.skillCount > 0],
    ['coursework categories', !coursework.missing],
    ['term', params.preferredTerms.length > 0],
    ['hours', typeof params.availabilityHours === 'number' && params.availabilityHours > 0],
    ['location/work mode', params.preferredLocations.length > 0 || params.preferredWorkModes.length > 0],
    ['grad year', typeof params.year === 'string' && params.year.trim().length > 0],
    ['experience', typeof params.experienceLevel === 'string' && params.experienceLevel.trim().length > 0],
  ] as const

  return {
    totalDimensions: checks.length,
    presentDimensions: checks.filter(([, ok]) => ok).length,
    missingDimensions: checks.filter(([, ok]) => !ok).map(([label]) => label),
  }
}
