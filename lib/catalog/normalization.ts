export function normalizeCatalogLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeCatalogToken(value: string) {
  return normalizeCatalogLabel(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function slugifyCatalogLabel(value: string) {
  return normalizeCatalogLabel(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
