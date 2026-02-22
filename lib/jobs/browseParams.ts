export type InternshipBrowseSortMode = 'best_match' | 'newest'

export type InternshipBrowseFilters = {
  searchQuery: string
  category: string
  payMin: string
  remoteOnly: boolean
  experience: string
  hoursMin: string
  hoursMax: string
  locationCity: string
  locationState: string
  radius: string
}

type NormalizeInternshipBrowseParamsInput = {
  sort?: string | null
  filters: InternshipBrowseFilters
  user: {
    isSignedIn: boolean
    role?: 'student' | 'employer' | null
  }
}

type NormalizeInternshipBrowseParamsResult = {
  sort: InternshipBrowseSortMode
  filters: InternshipBrowseFilters
  sortWasCoerced: boolean
}

function parseSort(value: string | null | undefined): InternshipBrowseSortMode | null {
  if (value === 'best_match' || value === 'newest') return value
  return null
}

export function normalizeInternshipBrowseParams(
  input: NormalizeInternshipBrowseParamsInput
): NormalizeInternshipBrowseParamsResult {
  const requestedSort = parseSort(input.sort)
  const canUseBestMatch = input.user.isSignedIn && input.user.role === 'student'
  const defaultSort: InternshipBrowseSortMode = canUseBestMatch ? 'best_match' : 'newest'

  let normalizedSort: InternshipBrowseSortMode = defaultSort
  if (requestedSort === 'best_match') {
    normalizedSort = canUseBestMatch ? 'best_match' : 'newest'
  } else if (requestedSort === 'newest') {
    normalizedSort = 'newest'
  }

  return {
    sort: normalizedSort,
    filters: input.filters,
    sortWasCoerced: requestedSort === 'best_match' && !canUseBestMatch,
  }
}
