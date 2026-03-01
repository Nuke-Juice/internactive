import { isPilotMode } from '@/lib/pilotMode'

export type FeedEligibilityInput = {
  is_active: boolean | null
  status?: string | null
  application_deadline?: string | null
  visibility?: string | null
}

function parseDateOnly(value: string) {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function todayUtcDateOnly(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function isFeedEligible(input: FeedEligibilityInput, options?: { now?: Date }) {
  if (input.is_active !== true) return false
  const status = (input.status ?? '').trim().toLowerCase()
  if (status === 'archived' || status === 'deleted' || status === 'private' || status === 'hidden') return false
  if (isPilotMode() && (input.visibility ?? 'admin_only') !== 'public_browse') return false

  const deadline = (input.application_deadline ?? '').trim()
  if (!deadline) return true

  const parsedDeadline = parseDateOnly(deadline)
  if (!parsedDeadline) return true
  const now = options?.now ?? new Date()
  const today = todayUtcDateOnly(now)
  return parsedDeadline.getTime() >= today.getTime()
}
