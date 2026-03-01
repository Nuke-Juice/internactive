export const PILOT_STAGES = [
  'new',
  'screened',
  'shortlist',
  'introduced',
  'interviewing',
  'hired',
  'rejected',
] as const

export type PilotStage = (typeof PILOT_STAGES)[number]
export type StudentPilotStatus = 'needsIntake' | 'inPool' | 'optedOut'

const PILOT_STAGE_LABELS: Record<PilotStage, string> = {
  new: 'New',
  screened: 'Screened',
  shortlist: 'Shortlist',
  introduced: 'Introduced',
  interviewing: 'Interviewing',
  hired: 'Hired',
  rejected: 'Rejected',
}

const PILOT_STAGE_PRIORITY: Record<PilotStage, number> = {
  shortlist: 0,
  introduced: 1,
  interviewing: 2,
  screened: 3,
  new: 4,
  hired: 5,
  rejected: 6,
}

export function isPilotStage(value: unknown): value is PilotStage {
  return typeof value === 'string' && (PILOT_STAGES as readonly string[]).includes(value)
}

export function normalizePilotStage(value: unknown): PilotStage {
  return isPilotStage(value) ? value : 'new'
}

export function formatPilotStage(value: unknown) {
  return PILOT_STAGE_LABELS[normalizePilotStage(value)]
}

export function pilotStagePriority(value: unknown) {
  return PILOT_STAGE_PRIORITY[normalizePilotStage(value)]
}

export function parsePilotTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function formatPilotTags(value: unknown) {
  if (!Array.isArray(value)) return ''
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(', ')
}

export function hasCompletedConciergeIntake(value: {
  concierge_opt_in?: boolean | null
  concierge_intake_completed_at?: string | null
} | null | undefined) {
  return value?.concierge_opt_in === true && typeof value?.concierge_intake_completed_at === 'string' && value.concierge_intake_completed_at.length > 0
}

export function isPilotMode() {
  return process.env.NEXT_PUBLIC_PILOT_MODE === 'true' || process.env.PILOT_MODE === 'true'
}

export function getStudentPilotStatus(
  profile:
    | {
        concierge_opt_in?: boolean | null
        concierge_intake_completed_at?: string | null
      }
    | null
    | undefined
): StudentPilotStatus {
  if (hasCompletedConciergeIntake(profile)) return 'inPool'
  if (profile?.concierge_opt_in === false) return 'optedOut'
  return 'needsIntake'
}
