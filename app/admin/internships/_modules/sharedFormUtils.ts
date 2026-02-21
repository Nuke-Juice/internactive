export function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  return value
}

export function normalizePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '1', 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return parsed
}

export function normalizeSource(value: string | undefined) {
  if (value === 'concierge' || value === 'partner') return value
  return 'employer_self'
}

export function normalizeExperience(value: string | undefined) {
  if (value === 'entry' || value === 'mid' || value === 'senior') return value
  return 'entry'
}

export function parseNullableNumber(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseNullableInteger(raw: FormDataEntryValue | null) {
  const value = parseNullableNumber(raw)
  if (value === null) return null
  return Math.round(value)
}

export function parseList(raw: FormDataEntryValue | null) {
  return String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.join('\n')
  if (typeof value === 'string') return value
  return ''
}

export function normalizeCompanyName(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parseJsonStringArray(raw: FormDataEntryValue | null) {
  const text = String(raw ?? '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  } catch {
    return []
  }
}

export function parseFormStringArray(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => String(item).trim())
    .filter(Boolean)
}
