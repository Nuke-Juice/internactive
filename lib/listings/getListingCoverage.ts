import { computeInternshipMatchCoverage, type InternshipCoverageResult } from '../admin/internshipMatchCoverage.ts'
import type { Internship } from '../jobs/internships.ts'

type RequiredCourseCategoryRelation = {
  category_id?: string | null
} | null

export type ListingCoverageSource = {
  majors?: Internship['majors'] | unknown | null
  required_skills?: string[] | null
  preferred_skills?: string[] | null
  required_skill_ids?: string[] | null
  preferred_skill_ids?: string[] | null
  required_course_category_ids?: string[] | null
  internship_required_course_categories?: RequiredCourseCategoryRelation[] | null
  target_graduation_years?: string[] | null
  target_student_year?: string | null
  experience_level?: string | null
  term?: string | null
  hours_min?: number | null
  hours_max?: number | null
  hours_per_week?: number | null
  work_mode?: string | null
  location_city?: string | null
  location_state?: string | null
  remote_allowed?: boolean | null
  verified_required_skill_links_count?: number | null
  verified_preferred_skill_links_count?: number | null
  required_course_category_links_count?: number | null
}

export type ListingCoverage = InternshipCoverageResult & {
  score: number
  missingFields: string[]
}

function hasMajors(value: ListingCoverageSource['majors']) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

function canonicalRequiredCategoryIds(listing: ListingCoverageSource) {
  if (Array.isArray(listing.required_course_category_ids)) {
    return listing.required_course_category_ids.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (Array.isArray(listing.internship_required_course_categories)) {
    return listing.internship_required_course_categories
      .map((item) => (item && typeof item.category_id === 'string' ? item.category_id : ''))
      .filter((item): item is string => item.trim().length > 0)
  }
  return []
}

export function getListingCoverage(listing: ListingCoverageSource): ListingCoverage {
  const requiredSkillsCount = Array.isArray(listing.required_skills) ? listing.required_skills.length : 0
  const preferredSkillsCount = Array.isArray(listing.preferred_skills) ? listing.preferred_skills.length : 0
  const requiredSkillIdsCount = Array.isArray(listing.required_skill_ids) ? listing.required_skill_ids.length : 0
  const preferredSkillIdsCount = Array.isArray(listing.preferred_skill_ids) ? listing.preferred_skill_ids.length : 0
  const requiredCourseCategoryIds = canonicalRequiredCategoryIds(listing)
  const requiredCourseCategoryCount =
    typeof listing.required_course_category_links_count === 'number'
      ? listing.required_course_category_links_count
      : requiredCourseCategoryIds.length
  const coverage = computeInternshipMatchCoverage({
    majorsPresent: hasMajors(listing.majors),
    courseworkCategoryLinkCount: requiredCourseCategoryCount,
    requiredSkillsCount,
    preferredSkillsCount,
    verifiedRequiredSkillLinks:
      typeof listing.verified_required_skill_links_count === 'number'
        ? listing.verified_required_skill_links_count
        : requiredSkillIdsCount > 0
          ? requiredSkillIdsCount
          : requiredSkillsCount,
    verifiedPreferredSkillLinks:
      typeof listing.verified_preferred_skill_links_count === 'number'
        ? listing.verified_preferred_skill_links_count
        : preferredSkillIdsCount > 0
          ? preferredSkillIdsCount
          : preferredSkillsCount,
    targetGraduationYearsPresent:
      Array.isArray(listing.target_graduation_years) && listing.target_graduation_years.length > 0,
    experiencePresent: Boolean((listing.target_student_year ?? listing.experience_level ?? '').trim()),
    termPresent: Boolean((listing.term ?? '').trim()),
    hoursPresent:
      (typeof listing.hours_min === 'number' && listing.hours_min > 0) ||
      (typeof listing.hours_max === 'number' && listing.hours_max > 0) ||
      (typeof listing.hours_per_week === 'number' && listing.hours_per_week > 0),
    locationOrRemotePresent:
      Boolean(listing.remote_allowed) ||
      ((listing.work_mode ?? '').trim().toLowerCase() === 'remote') ||
      Boolean((listing.location_city ?? '').trim()) ||
      Boolean((listing.location_state ?? '').trim()),
  })

  return {
    ...coverage,
    score: coverage.met,
    missingFields: coverage.missingLabels,
  }
}
