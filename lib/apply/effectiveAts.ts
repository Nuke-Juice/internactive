import { normalizeApplyMode, normalizeAtsStageMode, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'

export type EmployerAtsDefaultMode = 'none' | 'curated' | 'immediate'

export type EmployerAtsDefaults = {
  defaultAtsStageMode: EmployerAtsDefaultMode
  defaultExternalApplyUrl: string | null
  defaultExternalApplyType: 'new_tab' | 'redirect'
}

export type InternshipAtsConfig = {
  applyMode: string | null | undefined
  atsStageMode: string | null | undefined
  externalApplyUrl: string | null | undefined
  externalApplyType: string | null | undefined
  useEmployerAtsDefaults: boolean | null | undefined
}

export type EffectiveAtsConfig = {
  source: 'employer_defaults' | 'listing_override'
  applyMode: 'native' | 'ats_link' | 'hybrid'
  atsStageMode: 'curated' | 'immediate' | null
  externalApplyUrl: string | null
  externalApplyType: 'new_tab' | 'redirect' | null
  requiresExternalApply: boolean
  isCuratedInviteFlow: boolean
  hasConfiguredDestination: boolean
}

export function normalizeEmployerAtsDefaultMode(value: unknown): EmployerAtsDefaultMode {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'curated' || normalized === 'immediate') return normalized
  return 'none'
}

export function deriveAtsFromEmployerDefaults(input: EmployerAtsDefaults): {
  applyMode: 'native' | 'ats_link' | 'hybrid'
  atsStageMode: 'curated' | 'immediate' | null
  externalApplyUrl: string | null
  externalApplyType: 'new_tab' | 'redirect' | null
} {
  const defaultMode = normalizeEmployerAtsDefaultMode(input.defaultAtsStageMode)
  const defaultUrl = normalizeExternalApplyUrl(input.defaultExternalApplyUrl)
  const defaultType = input.defaultExternalApplyType === 'redirect' ? 'redirect' : 'new_tab'
  if (defaultMode === 'none') {
    return {
      applyMode: 'native',
      atsStageMode: null,
      externalApplyUrl: null,
      externalApplyType: null,
    }
  }
  return {
    applyMode: defaultMode === 'immediate' ? 'ats_link' : 'hybrid',
    atsStageMode: defaultMode,
    externalApplyUrl: defaultUrl,
    externalApplyType: defaultType,
  }
}

export function resolveEffectiveAtsConfig(input: {
  internship: InternshipAtsConfig
  employerDefaults: EmployerAtsDefaults
}): EffectiveAtsConfig {
  const useEmployerAtsDefaults = input.internship.useEmployerAtsDefaults !== false
  const source = useEmployerAtsDefaults ? 'employer_defaults' : 'listing_override'

  const inherited = deriveAtsFromEmployerDefaults(input.employerDefaults)
  const applyMode = useEmployerAtsDefaults
    ? inherited.applyMode
    : normalizeApplyMode(input.internship.applyMode)
  const atsStageMode = applyMode === 'native'
    ? null
    : (useEmployerAtsDefaults
      ? inherited.atsStageMode
      : normalizeAtsStageMode(input.internship.atsStageMode))
  const externalApplyUrl = useEmployerAtsDefaults
    ? inherited.externalApplyUrl
    : normalizeExternalApplyUrl(input.internship.externalApplyUrl)
  const externalApplyType = applyMode === 'native'
    ? null
    : ((useEmployerAtsDefaults
      ? inherited.externalApplyType
      : (String(input.internship.externalApplyType ?? '').trim().toLowerCase() === 'redirect' ? 'redirect' : 'new_tab')))
  const requiresExternalApply = applyMode === 'hybrid' || applyMode === 'ats_link'

  return {
    source,
    applyMode,
    atsStageMode,
    externalApplyUrl: requiresExternalApply ? externalApplyUrl : null,
    externalApplyType: requiresExternalApply ? externalApplyType : null,
    requiresExternalApply,
    isCuratedInviteFlow: applyMode === 'hybrid' && atsStageMode === 'curated',
    hasConfiguredDestination: !requiresExternalApply || Boolean(externalApplyUrl),
  }
}
