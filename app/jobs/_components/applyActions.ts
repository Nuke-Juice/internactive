'use server'

import { supabaseServer } from '@/lib/supabase/server'
import {
  APPLY_ERROR,
  isCapReachedApplicationError,
  isDuplicateApplicationConstraintError,
  type ApplyErrorCode,
} from '@/lib/applyErrors'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { buildApplicationMatchSnapshot } from '@/lib/applicationMatchSnapshot'
import { sendEmployerApplicationAlert } from '@/lib/email/employerAlerts'
import { guardApplicationSubmit, EMAIL_VERIFICATION_ERROR } from '@/lib/auth/verifiedActionGate'
import { normalizeApplyMode, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { normalizeListingCoursework } from '@/lib/coursework/normalizeListingCoursework'
import { getStudentCourseworkFeatures } from '@/lib/coursework/getStudentCourseworkFeatures'

type ApplyFromMicroOnboardingInput = {
  listingId: string
}

type ApplyFromMicroOnboardingResult =
  | { ok: true }
  | {
      ok: false
      code: ApplyErrorCode
      missing?: string[]
    }

export type ApplyFromListingModalState = {
  ok: boolean
  error?: string
  code?: ApplyErrorCode
  externalApplyUrl?: string | null
  externalApplyRequired?: boolean
}

function isSchemaCacheError(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('schema cache')
}

export async function applyFromMicroOnboardingAction({
  listingId,
}: ApplyFromMicroOnboardingInput): Promise<ApplyFromMicroOnboardingResult> {
  const supabase = await supabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: null,
      properties: { listing_id: listingId, code: APPLY_ERROR.AUTH_REQUIRED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.AUTH_REQUIRED }
  }

  const verificationGate = guardApplicationSubmit(user, listingId)
  if (!verificationGate.ok) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: EMAIL_VERIFICATION_ERROR, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.EMAIL_NOT_VERIFIED }
  }

  const resumePath =
    typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path.trim() : ''

  if (!resumePath) {
    await trackAnalyticsEvent({
      eventName: 'apply_recovery_started',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
    })
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.RESUME_REQUIRED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.RESUME_REQUIRED }
  }

  const [{ data: listing }, { data: userRow }, { data: profile }, courseworkFeatures] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, start_date, application_deadline, role_category, required_skills, preferred_skills, recommended_coursework, apply_mode, external_apply_url, application_cap, applications_count, internship_required_course_categories(category_id, category:canonical_course_categories(name, slug)), internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('student_profiles')
      .select('school, major_id, majors, year, experience_level, coursework, coursework_unverified, interests, availability_start_month, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle(),
    getStudentCourseworkFeatures({
      supabase,
      studentId: user.id,
    }),
  ])

  if (!listing?.id) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.LISTING_NOT_FOUND, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND }
  }
  const applicationCap = typeof listing.application_cap === 'number' ? listing.application_cap : 60
  const applicationsCount = typeof listing.applications_count === 'number' ? listing.applications_count : 0
  if (applicationsCount >= applicationCap) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.CAP_REACHED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.CAP_REACHED }
  }

  if (!userRow || userRow.role !== 'student') {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.ROLE_NOT_STUDENT, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.ROLE_NOT_STUDENT }
  }

  const completeness = getMinimumProfileCompleteness(profile)
  if (!completeness.ok) {
    await trackAnalyticsEvent({
      eventName: 'apply_recovery_started',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
    })
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing },
    })
    return { ok: false, code: APPLY_ERROR.PROFILE_INCOMPLETE, missing: completeness.missing }
  }

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('student_id', user.id)
    .eq('internship_id', listingId)
    .maybeSingle()

  if (existing?.id) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION }
  }

  const normalizedListingCoursework = normalizeListingCoursework({
    internship_required_course_categories: listing.internship_required_course_categories,
    internship_coursework_category_links: listing.internship_coursework_category_links,
    internship_coursework_items: [],
  })

  const snapshot = buildApplicationMatchSnapshot({
    internship: {
      ...listing,
      required_course_category_ids: normalizedListingCoursework.requiredCanonicalCategoryIds,
      required_course_category_names: normalizedListingCoursework.requiredCanonicalCategoryNames,
      coursework_category_ids: normalizedListingCoursework.legacyCategoryIds,
      coursework_category_names: normalizedListingCoursework.legacyCategoryNames,
    },
    profile: {
      ...(profile ?? {}),
      canonical_coursework_category_ids: courseworkFeatures.canonicalCategoryIds,
      canonical_coursework_level_bands: courseworkFeatures.canonicalCourseLevelBands,
      coursework_category_ids: courseworkFeatures.legacyCategoryIds,
      coursework: courseworkFeatures.textCoursework,
      coursework_unverified: courseworkFeatures.unverifiedText,
    },
  })
  const applyMode = normalizeApplyMode(String(listing.apply_mode ?? 'native'))
  const requiresExternalApply = applyMode === 'ats_link' || applyMode === 'hybrid'
  const externalApplyUrl = normalizeExternalApplyUrl(String(listing.external_apply_url ?? ''))
  if (requiresExternalApply && !externalApplyUrl) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: ['external_apply_url_missing'] },
    })
    return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED }
  }

  const { data: insertedApplication, error: insertError } = await supabase.rpc('submit_application_with_cap', {
    in_internship_id: listingId,
    in_student_id: user.id,
    in_resume_url: resumePath,
    in_status: 'submitted',
    in_external_apply_required: requiresExternalApply,
    in_quick_apply_note: null,
    in_match_score: snapshot.match_score,
    in_match_reasons: snapshot.match_reasons,
    in_match_gaps: snapshot.match_gaps,
    in_matching_version: snapshot.matching_version,
  })

  if (insertError) {
    if (isCapReachedApplicationError(insertError)) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: user.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.CAP_REACHED, missing: [] },
      })
      return { ok: false, code: APPLY_ERROR.CAP_REACHED }
    }
    if (isDuplicateApplicationConstraintError(insertError)) {
      await trackAnalyticsEvent({
        eventName: 'apply_blocked',
        userId: user.id,
        properties: { listing_id: listingId, code: APPLY_ERROR.DUPLICATE_APPLICATION, missing: [] },
      })
      return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION }
    }

    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: [] },
    })
    return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED }
  }
  const insertedApplicationId = Array.isArray(insertedApplication)
    ? insertedApplication[0]?.id
    : insertedApplication?.id

  await trackAnalyticsEvent({
    eventName: 'submit_apply_success',
    userId: user.id,
    properties: { listing_id: listingId, source: 'applyFromMicroOnboardingAction' },
  })
  await trackAnalyticsEvent({
    eventName: 'quick_apply_submitted',
    userId: user.id,
    properties: { listing_id: listingId, application_id: insertedApplicationId ?? null, apply_mode: applyMode },
  })

  if (insertedApplicationId) {
    try {
      await sendEmployerApplicationAlert({ applicationId: insertedApplicationId })
    } catch {
      // no-op; email should not block application submission
    }
  }

  return { ok: true }
}

export async function submitApplicationFromListingModalAction(
  _prev: ApplyFromListingModalState,
  formData: FormData
): Promise<ApplyFromListingModalState> {
  const listingId = String(formData.get('listing_id') ?? '').trim()
  const screeningResponseInput = String(formData.get('screening_response') ?? '').trim()
  const screeningResponse = screeningResponseInput.length > 280 ? screeningResponseInput.slice(0, 280) : screeningResponseInput
  const resumeFile = formData.get('resume') as File | null
  const hasUpload = Boolean(resumeFile && resumeFile.size > 0 && resumeFile.name)

  if (!listingId) {
    return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND, error: 'Missing listing context.' }
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, code: APPLY_ERROR.AUTH_REQUIRED, error: 'Please sign in to apply.' }

  const verificationGate = guardApplicationSubmit(user, listingId)
  if (!verificationGate.ok) {
    const code = verificationGate.code === EMAIL_VERIFICATION_ERROR ? APPLY_ERROR.EMAIL_NOT_VERIFIED : APPLY_ERROR.AUTH_REQUIRED
    return { ok: false, code, error: code === APPLY_ERROR.EMAIL_NOT_VERIFIED ? 'Verify your email before applying.' : 'Please sign in to apply.' }
  }

  const [{ data: listing }, { data: userRow }] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, start_date, application_deadline, role_category, required_skills, preferred_skills, recommended_coursework, apply_mode, external_apply_url, application_cap, applications_count, internship_required_course_categories(category_id, category:canonical_course_categories(name, slug)), internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])

  if (!listing?.id) return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND, error: 'Listing not found.' }
  if (!userRow || userRow.role !== 'student') {
    return { ok: false, code: APPLY_ERROR.ROLE_NOT_STUDENT, error: 'Use a student account to apply.' }
  }

  const applicationCap = typeof listing.application_cap === 'number' ? listing.application_cap : 60
  const applicationsCount = typeof listing.applications_count === 'number' ? listing.applications_count : 0
  if (applicationsCount >= applicationCap) {
    return { ok: false, code: APPLY_ERROR.CAP_REACHED, error: `Applications closed (${applicationCap} applicants).` }
  }

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('student_id', user.id)
    .eq('internship_id', listingId)
    .maybeSingle()
  if (existing?.id) return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION, error: 'You already applied to this internship.' }

  const fullProfileSelect =
    'school, major_id, majors, year, experience_level, coursework, coursework_unverified, interests, availability_start_month, availability_hours_per_week'
  const fallbackProfileSelect =
    'school, major_id, majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week'
  const profileResult = await supabase
    .from('student_profiles')
    .select(fullProfileSelect)
    .eq('user_id', user.id)
    .maybeSingle()
  const profile =
    profileResult.error && isSchemaCacheError(profileResult.error.message)
      ? (
          await supabase
            .from('student_profiles')
            .select(fallbackProfileSelect)
            .eq('user_id', user.id)
            .maybeSingle()
        ).data
      : profileResult.data

  const completeness = getMinimumProfileCompleteness(profile)
  if (!completeness.ok) {
    return {
      ok: false,
      code: APPLY_ERROR.PROFILE_INCOMPLETE,
      error: 'Complete required profile fields before applying.',
    }
  }

  const courseworkFeatures = await getStudentCourseworkFeatures({
    supabase,
    studentId: user.id,
    profileCoursework: profile?.coursework,
    profileCourseworkUnverified:
      profile && typeof profile === 'object' && 'coursework_unverified' in profile
        ? (profile as { coursework_unverified?: unknown }).coursework_unverified
        : undefined,
  })

  let resumePath = typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path.trim() : ''
  if (hasUpload && resumeFile) {
    const isPdf = resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) return { ok: false, code: APPLY_ERROR.INVALID_RESUME_FILE, error: 'Resume must be a PDF.' }

    const resumeId = crypto.randomUUID()
    const nextPath = `resumes/${user.id}/${listingId}/${resumeId}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(nextPath, resumeFile, { contentType: 'application/pdf', upsert: false })

    if (uploadError) return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, error: 'Could not upload resume right now.' }
    resumePath = nextPath
  }

  if (!resumePath) return { ok: false, code: APPLY_ERROR.RESUME_REQUIRED, error: 'Upload a resume to apply.' }

  const normalizedListingCoursework = normalizeListingCoursework({
    internship_required_course_categories: listing.internship_required_course_categories,
    internship_coursework_category_links: listing.internship_coursework_category_links,
    internship_coursework_items: [],
  })

  const snapshot = buildApplicationMatchSnapshot({
    internship: {
      ...listing,
      required_course_category_ids: normalizedListingCoursework.requiredCanonicalCategoryIds,
      required_course_category_names: normalizedListingCoursework.requiredCanonicalCategoryNames,
      coursework_category_ids: normalizedListingCoursework.legacyCategoryIds,
      coursework_category_names: normalizedListingCoursework.legacyCategoryNames,
    },
    profile: {
      ...(profile ?? {}),
      canonical_coursework_category_ids: courseworkFeatures.canonicalCategoryIds,
      canonical_coursework_level_bands: courseworkFeatures.canonicalCourseLevelBands,
      coursework_category_ids: courseworkFeatures.legacyCategoryIds,
      coursework: courseworkFeatures.textCoursework,
      coursework_unverified: courseworkFeatures.unverifiedText,
    },
  })

  const applyMode = normalizeApplyMode(String(listing.apply_mode ?? 'native'))
  const requiresExternalApply = applyMode === 'ats_link' || applyMode === 'hybrid'
  const externalApplyUrl = normalizeExternalApplyUrl(String(listing.external_apply_url ?? ''))
  if (requiresExternalApply && !externalApplyUrl) {
    return {
      ok: false,
      code: APPLY_ERROR.APPLICATION_INSERT_FAILED,
      error: 'This listing is missing an external apply link.',
    }
  }

  const { data: insertedApplication, error: insertError } = await supabase.rpc('submit_application_with_cap', {
    in_internship_id: listingId,
    in_student_id: user.id,
    in_resume_url: resumePath,
    in_status: 'submitted',
    in_external_apply_required: requiresExternalApply,
    in_quick_apply_note: screeningResponse || null,
    in_match_score: snapshot.match_score,
    in_match_reasons: snapshot.match_reasons,
    in_match_gaps: snapshot.match_gaps,
    in_matching_version: snapshot.matching_version,
  })

  if (insertError) {
    if (isCapReachedApplicationError(insertError)) return { ok: false, code: APPLY_ERROR.CAP_REACHED, error: `Applications closed (${applicationCap} applicants).` }
    if (isDuplicateApplicationConstraintError(insertError)) return { ok: false, code: APPLY_ERROR.DUPLICATE_APPLICATION, error: 'You already applied to this internship.' }
    return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, error: 'Could not submit your application right now.' }
  }

  const insertedApplicationId = Array.isArray(insertedApplication) ? insertedApplication[0]?.id : insertedApplication?.id
  await trackAnalyticsEvent({
    eventName: 'submit_apply_success',
    userId: user.id,
    properties: { listing_id: listingId, source: 'job_detail_modal' },
  })

  if (insertedApplicationId) {
    try {
      await sendEmployerApplicationAlert({ applicationId: insertedApplicationId })
    } catch {
      // no-op
    }
  }

  return {
    ok: true,
    externalApplyRequired: requiresExternalApply,
    externalApplyUrl: externalApplyUrl || null,
  }
}
