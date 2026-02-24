export type ApplyMode = 'native' | 'ats_link' | 'hybrid'
export type AtsStageMode = 'curated' | 'immediate'
export type WorkMode = 'in_person' | 'hybrid' | 'remote'

export type CatalogOption = {
  id: string
  name: string
}

export type ListingStep1FieldKey =
  | 'title'
  | 'category'
  | 'work_mode'
  | 'location_city'
  | 'location_state'
  | 'external_apply_url'
  | 'remote_eligibility'

export type ListingStep2FieldKey =
  | 'pay_min'
  | 'pay_max'
  | 'hours_min'
  | 'hours_max'
  | 'duration_weeks'
  | 'start_date'
  | 'application_deadline'

export type ListingStep4FieldKey =
  | 'short_summary'

export type ListingTemplate = {
  key: string
  label: string
  title: string
  category: string
  requiredSkills: string[]
  preferredSkills: string[]
  majors: string[]
  courseworkCategories: string[]
  responsibilities: string[]
  qualifications: string[]
}

export type ListingWizardInitialValues = {
  title: string
  companyName: string
  category: string
  workMode: WorkMode
  locationCity: string
  locationState: string
  employmentType: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship'
  internshipTypes: string
  workAuthorizationScope: string
  remoteEligibilityMode: 'single_state' | 'selected_states' | 'us_only'
  remoteEligibleStates: string[]
  applyMode: ApplyMode
  atsStageMode: AtsStageMode
  externalApplyUrl: string
  externalApplyType: string
  useEmployerAtsDefaults: boolean
  payType: 'hourly'
  compensationCurrency: string
  compensationInterval: 'hour' | 'week' | 'month' | 'year'
  compensationIsEstimated: boolean
  bonusEligible: boolean
  compensationNotes: string
  payMin: string
  payMax: string
  hoursMin: string
  hoursMax: string
  durationWeeks: string
  startDate: string
  applicationDeadline: string
  shortSummary: string
  description: string
  descriptionRaw: string
  responsibilities: string
  minimumQualifications: string
  qualifications: string
  preferredQualifications: string
  screeningQuestion: string
  complianceEeoProvided: boolean
  compliancePayTransparencyProvided: boolean
  complianceAtWillProvided: boolean
  complianceAccommodationsProvided: boolean
  complianceAccommodationsEmail: string
  complianceText: string
  sourcePlatform: string
  sourcePostedDate: string
  sourceApplicantCount: string
  sourcePromoted: boolean
  sourceResponsesManagedOffPlatform: boolean
  targetGraduationYears: string[]
  resumeRequired: boolean
  requiredSkillLabels: string[]
  preferredSkillLabels: string[]
  majorLabels: string[]
  courseworkCategoryLabels: string[]
}
