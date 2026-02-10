import type { WorkMode } from '@/lib/matching'

export type StudentPreferenceSignals = {
  preferredTerms: string[]
  preferredLocations: string[]
  preferredWorkModes: WorkMode[]
  remoteOnly: boolean
  skills: string[]
}

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function parseWorkMode(value: string): WorkMode | null {
  const normalized = normalizeText(value)
  if (normalized.includes('remote')) return 'remote'
  if (normalized.includes('hybrid')) return 'hybrid'
  if (normalized.includes('on-site') || normalized.includes('onsite') || normalized.includes('in person')) {
    return 'on-site'
  }
  return null
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  return []
}

export function parseStudentPreferenceSignals(interests: string | null | undefined): StudentPreferenceSignals {
  if (!interests) {
    return {
      preferredTerms: [],
      preferredLocations: [],
      preferredWorkModes: [],
      remoteOnly: false,
      skills: [],
    }
  }

  try {
    const parsed = JSON.parse(interests) as Record<string, unknown>
    const preferredTerms = asStringArray(parsed.preferred_terms ?? parsed.seasons)
    const preferredLocations = asStringArray(parsed.preferred_locations)
    const preferredWorkModes = asStringArray(parsed.preferred_work_modes)
      .map(parseWorkMode)
      .filter((mode): mode is WorkMode => mode !== null)
    const remoteOnly = Boolean(parsed.remote_only)
    const skills = asStringArray(parsed.skills)

    return {
      preferredTerms,
      preferredLocations,
      preferredWorkModes,
      remoteOnly,
      skills,
    }
  } catch {
    return {
      preferredTerms: [],
      preferredLocations: [],
      preferredWorkModes: [],
      remoteOnly: false,
      skills: [],
    }
  }
}
