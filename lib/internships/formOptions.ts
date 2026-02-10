const TERM_SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const

export function getTermOptions() {
  const currentYear = new Date().getUTCFullYear()
  const options: string[] = []

  for (let year = currentYear; year <= currentYear + 3; year += 1) {
    for (const season of TERM_SEASONS) {
      options.push(`${season} ${year}`)
    }
  }

  return options
}

export function getGraduationYearOptions() {
  const currentYear = new Date().getUTCFullYear()
  const options: string[] = []
  for (let year = currentYear; year <= currentYear + 8; year += 1) {
    options.push(String(year))
  }
  return options
}

