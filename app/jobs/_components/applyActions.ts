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

  const [{ data: listing }, { data: userRow }, { data: profile }, { data: studentCourseworkCategoryRows }] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, start_date, application_deadline, role_category, required_skills, preferred_skills, recommended_coursework, apply_mode, external_apply_url, application_cap, applications_count, internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('student_profiles')
      .select('school, major_id, majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
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

  const snapshot = buildApplicationMatchSnapshot({
    internship: {
      ...listing,
      coursework_category_ids: (listing.internship_coursework_category_links ?? [])
        .map((item) => item.category_id)
        .filter((value): value is string => typeof value === 'string'),
      coursework_category_names: (listing.internship_coursework_category_links ?? [])
        .map((item) => {
          const category = item.category as { name?: string | null } | null
          return typeof category?.name === 'string' ? category.name : ''
        })
        .filter((value): value is string => value.length > 0),
    },
    profile: {
      ...(profile ?? {}),
      coursework_category_ids: (studentCourseworkCategoryRows ?? [])
        .map((item) => item.category_id)
        .filter((value): value is string => typeof value === 'string'),
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
