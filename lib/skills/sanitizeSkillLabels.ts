const DISALLOWED_PREFIXES = ['pursuing ', 'currently pursuing ', 'working toward ']

function normalizeCatalogLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function sanitizeSkillLabels(input: string[]) {
  const cleaned = input.map(normalizeCatalogLabel).filter(Boolean)
  const valid: string[] = []
  const rejected: string[] = []

  for (const item of cleaned) {
    const lower = item.toLowerCase()
    const looksLikeQualification = DISALLOWED_PREFIXES.some((prefix) => lower.startsWith(prefix)) || lower.includes(' degree')
    if (looksLikeQualification) {
      rejected.push(item)
      continue
    }
    valid.push(item)
  }

  return { valid, rejected }
}
