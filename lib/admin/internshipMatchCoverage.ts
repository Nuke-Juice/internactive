export type MatchSignalKey =
  | 'majors'
  | 'coursework_categories'
  | 'skills'
  | 'target_graduation_years'
  | 'experience_level'
  | 'term'
  | 'hours_per_week'
  | 'location_or_remote'

export type MatchSignalDefinition = {
  key: MatchSignalKey
  label: string
  fixHint: string
}

export const MATCH_SIGNALS: readonly MatchSignalDefinition[] = [
  {
    key: 'majors',
    label: 'Majors',
    fixHint: 'Add at least one target major.',
  },
  {
    key: 'coursework_categories',
    label: 'Coursework categories',
    fixHint: 'Link one or more canonical coursework categories.',
  },
  {
    key: 'skills',
    label: 'Skills',
    fixHint: 'Add required/preferred skills and map them to canonical skill items.',
  },
  {
    key: 'target_graduation_years',
    label: 'Graduation years',
    fixHint: 'Leave blank for all years, or select one or more years to restrict eligibility.',
  },
  {
    key: 'experience_level',
    label: 'Experience level',
    fixHint: 'Set the expected experience level.',
  },
  {
    key: 'term',
    label: 'Term',
    fixHint: 'Set start and end month/year.',
  },
  {
    key: 'hours_per_week',
    label: 'Hours/week',
    fixHint: 'Set weekly hours (min/max).',
  },
  {
    key: 'location_or_remote',
    label: 'Location or remote',
    fixHint: 'Provide a city/state or mark as remote.',
  },
] as const

export type InternshipCoverageInput = {
  majorsPresent: boolean
  courseworkCategoryLinkCount: number
  requiredSkillsCount: number
  preferredSkillsCount: number
  verifiedRequiredSkillLinks: number
  verifiedPreferredSkillLinks: number
  targetGraduationYearsPresent: boolean
  experiencePresent: boolean
  termPresent: boolean
  hoursPresent: boolean
  locationOrRemotePresent: boolean
}

export type MatchSignalResult = MatchSignalDefinition & {
  present: boolean
  detail: string
}

export type InternshipCoverageResult = {
  met: number
  total: number
  missingLabels: string[]
  missingSummary: string
  signals: MatchSignalResult[]
  skillsBreakdown: {
    requiredCount: number
    preferredCount: number
    verifiedLinks: number
  }
  courseworkBreakdown: {
    categoryLinks: number
  }
}

export function computeInternshipMatchCoverage(input: InternshipCoverageInput): InternshipCoverageResult {
  const totalVerifiedSkillLinks = input.verifiedRequiredSkillLinks + input.verifiedPreferredSkillLinks
  const totalDeclaredSkills = input.requiredSkillsCount + input.preferredSkillsCount

  const byKey: Record<MatchSignalKey, { present: boolean; detail: string }> = {
    majors: {
      present: input.majorsPresent,
      detail: input.majorsPresent ? 'At least one major set' : 'No majors set',
    },
    coursework_categories: {
      present: input.courseworkCategoryLinkCount > 0,
      detail:
        input.courseworkCategoryLinkCount > 0
          ? `${input.courseworkCategoryLinkCount} linked`
          : 'No linked categories',
    },
    skills: {
      present: totalDeclaredSkills > 0,
      detail: `${input.requiredSkillsCount} required, ${input.preferredSkillsCount} preferred, ${totalVerifiedSkillLinks} verified links`,
    },
    target_graduation_years: {
      present: input.targetGraduationYearsPresent,
      detail: input.targetGraduationYearsPresent ? 'All years (default) or specific years selected' : 'Restricted years enabled but none selected',
    },
    experience_level: {
      present: input.experiencePresent,
      detail: input.experiencePresent ? 'Set' : 'Missing',
    },
    term: {
      present: input.termPresent,
      detail: input.termPresent ? 'Set' : 'Missing',
    },
    hours_per_week: {
      present: input.hoursPresent,
      detail: input.hoursPresent ? 'Set' : 'Missing',
    },
    location_or_remote: {
      present: input.locationOrRemotePresent,
      detail: input.locationOrRemotePresent ? 'Set' : 'Missing',
    },
  }

  const signals: MatchSignalResult[] = MATCH_SIGNALS.map((signal) => ({
    ...signal,
    present: byKey[signal.key].present,
    detail: byKey[signal.key].detail,
  }))

  const met = signals.filter((signal) => signal.present).length
  const missingLabels = signals.filter((signal) => !signal.present).map((signal) => signal.label)

  return {
    met,
    total: MATCH_SIGNALS.length,
    missingLabels,
    missingSummary: missingLabels.length > 0 ? `Missing: ${missingLabels.join(', ')}` : 'All match signals present',
    signals,
    skillsBreakdown: {
      requiredCount: input.requiredSkillsCount,
      preferredCount: input.preferredSkillsCount,
      verifiedLinks: totalVerifiedSkillLinks,
    },
    courseworkBreakdown: {
      categoryLinks: input.courseworkCategoryLinkCount,
    },
  }
}
