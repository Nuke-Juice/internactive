export function clampInt(value: unknown, options: { min: number; max: number; fallback: number }) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return options.fallback
  const intValue = Math.trunc(parsed)
  return Math.min(Math.max(intValue, options.min), options.max)
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function getArrayField(body: unknown, field: string) {
  if (!body || typeof body !== 'object') return []
  const value = (body as Record<string, unknown>)[field]
  return readStringArray(value)
}
