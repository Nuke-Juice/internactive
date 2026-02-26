export function formatWorkMode(mode: string | null | undefined) {
  const normalized = String(mode ?? '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'in_person') return 'In person'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  return normalized
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export function formatLocationWithWorkMode(location: string | null | undefined, mode: string | null | undefined) {
  const base = String(location ?? '').trim()
  if (!base) return ''
  const formattedMode = formatWorkMode(mode)
  if (!formattedMode) return base
  return base.replace(/\((in_person|hybrid|remote)\)/gi, `(${formattedMode})`)
}
