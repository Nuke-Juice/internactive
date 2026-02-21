const DISALLOWED_PREFIXES = ['pursuing ', 'currently pursuing ', 'working toward ']
const MAX_SKILL_LABEL_LENGTH = 60

function normalizeCatalogLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function sanitizeSkillLabels(input: string[]) {
  const cleaned = input.map(normalizeCatalogLabel).filter(Boolean)
  const valid: string[] = []
  const rejected: string[] = []
  const seenNormalized = new Set<string>()

  for (const item of cleaned) {
    const lower = item.toLowerCase()
    const looksLikeQualification = DISALLOWED_PREFIXES.some((prefix) => lower.startsWith(prefix)) || lower.includes(' degree')
    const normalized = lower.replace(/\s+/g, ' ').trim()
    if (looksLikeQualification || item.length > MAX_SKILL_LABEL_LENGTH || !normalized) {
      rejected.push(item)
      continue
    }
    if (seenNormalized.has(normalized)) continue
    seenNormalized.add(normalized)
    valid.push(item)
  }

  return { valid, rejected }
}
