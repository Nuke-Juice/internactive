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
import { normalizeEmployerAtsDefaultMode, resolveEffectiveAtsConfig, type EmployerAtsDefaults } from '@/lib/apply/effectiveAts'
import { normalizeListingCoursework } from '@/lib/coursework/normalizeListingCoursework'
import { getStudentCourseworkFeatures } from '@/lib/coursework/getStudentCourseworkFeatures'
import { dispatchInAppNotification } from '@/lib/notifications/dispatcher'

type ApplyFromMicroOnboardingInput = {
  listingId: string
}

type ApplyFromMicroOnboardingResult =
  | { ok: true }
  | {
      ok: false
      code: ApplyErrorCode
      missing?: string[]
      profile_missing?: string[]
      application_missing?: string[]
      eligibility_failed?: string[]
    }

export type ApplyFromListingModalState = {
  ok: boolean
  error?: string
  code?: ApplyErrorCode
  profile_missing?: string[]
  application_missing?: string[]
  eligibility_failed?: string[]
  externalApplyUrl?: string | null
  externalApplyRequired?: boolean
  successMessage?: string
}

function isSchemaCacheError(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('schema cache')
}

function hasDeadlinePassed(value: string | null | undefined) {
  if (!value) return false
  const deadline = new Date(value)
  if (!Number.isFinite(deadline.getTime())) return false
  return deadline.getTime() < Date.now()
}

type ApplyGateReasons = {
  profile_missing: string[]
  application_missing: string[]
  eligibility_failed: string[]
}

function parseTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeGradYear(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function labelProfileField(field: string) {
  if (field === 'school') return 'School'
  if (field === 'major') return 'Major'
  if (field === 'availability_start_month') return 'Availability start month'
  if (field === 'availability_hours_per_week') return 'Availability hours per week'
  if (field === 'graduation_year') return 'Graduation year'
  return field
}

function profileMissingMessage(fields: string[]) {
  const labels = fields.map(labelProfileField)
  if (labels.length === 0) return 'Complete required profile fields before applying.'
  return `Complete required profile fields before applying: ${labels.join(', ')}.`
}

function evaluateApplyGate(params: {
  listing: {
    majors?: unknown
    target_graduation_years?: unknown
    resume_required?: boolean | null
    restrict_by_major?: boolean | null
    restrict_by_year?: boolean | null
  }
  profile: {
    school?: string | null
    university_id?: string | null
    major_id?: string | null
    major?: { name?: string | null } | Array<{ name?: string | null }> | null
    majors?: string[] | string | null
    year?: string | null
    availability_start_month?: string | null
    availability_hours_per_week?: number | string | null
  } | null
  hasResume: boolean
  listingId: string
  userId: string
}) {
  const profileMissing = getMinimumProfileCompleteness(params.profile).missing.map((item) => String(item))
  const gradYear = normalizeGradYear(params.profile?.year)
  if (!gradYear && !profileMissing.includes('graduation_year')) {
    profileMissing.push('graduation_year')
  }
  const reasons: ApplyGateReasons = {
    profile_missing: profileMissing,
    application_missing: [],
    eligibility_failed: [],
  }

  const requiresResume = params.listing.resume_required !== false
  if (requiresResume && !params.hasResume) {
    reasons.application_missing.push('resume')
  }

  const restrictByMajor = params.listing.restrict_by_major === true
  const restrictByYear = params.listing.restrict_by_year === true
  const listingMajors = parseTextList(params.listing.majors).map((item) => item.toLowerCase())
  const canonicalMajor =
    Array.isArray(params.profile?.major)
      ? params.profile?.major[0]?.name
      : params.profile?.major?.name
  const studentMajors = Array.from(
    new Set([...parseTextList(params.profile?.majors), typeof canonicalMajor === 'string' ? canonicalMajor : ''])
  ).map((item) => item.toLowerCase())
  if (restrictByMajor && listingMajors.length > 0) {
    const majorMatch = studentMajors.some((major) => listingMajors.includes(major))
    if (!majorMatch) {
      reasons.eligibility_failed.push('Major not eligible')
    }
  }

  const targetYears = parseTextList(params.listing.target_graduation_years).map(normalizeGradYear).filter(Boolean)
  if (restrictByYear && targetYears.length > 0 && gradYear && !targetYears.includes(gradYear)) {
    reasons.eligibility_failed.push('Graduation year not eligible')
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[apply.gate.debug]', {
      listing_id: params.listingId,
      user_id: params.userId,
      profile_missing: reasons.profile_missing,
      application_missing: reasons.application_missing,
      eligibility_failed: reasons.eligibility_failed,
      raw: {
        profile_year: params.profile?.year ?? null,
        profile_majors: params.profile?.majors ?? null,
        listing_majors: params.listing.majors ?? null,
        listing_target_graduation_years: params.listing.target_graduation_years ?? null,
        restrict_by_major: params.listing.restrict_by_major ?? false,
        restrict_by_year: params.listing.restrict_by_year ?? false,
        resume_required: params.listing.resume_required ?? true,
      },
    })
  }

  return {
    canApply:
      reasons.profile_missing.length === 0 &&
      reasons.application_missing.length === 0 &&
      reasons.eligibility_failed.length === 0,
    reasons,
  }
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

  const [{ data: listing }, { data: userRow }, { data: profile }, courseworkFeatures] = await Promise.all([
    supabase
      .from('internships')
      .select(
        'id, employer_id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, start_date, application_deadline, role_category, required_skills, preferred_skills, recommended_coursework, apply_mode, ats_stage_mode, external_apply_url, use_employer_ats_defaults, application_cap, applications_count, resume_required, restrict_by_major, restrict_by_year, internship_required_course_categories(category_id, category:canonical_course_categories(name, slug)), internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('student_profiles')
      .select('school, university_id, major_id, major:canonical_majors(name), majors, year, experience_level, coursework, coursework_unverified, interests, availability_start_month, availability_hours_per_week')
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
  if (hasDeadlinePassed(listing.application_deadline ?? null)) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.LISTING_NOT_FOUND, missing: ['deadline_passed'] },
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

  const gate = evaluateApplyGate({
    listing,
    profile,
    hasResume: Boolean(resumePath),
    listingId,
    userId: user.id,
  })
  if (!gate.canApply) {
    const allMissing = [
      ...gate.reasons.profile_missing,
      ...gate.reasons.application_missing,
      ...gate.reasons.eligibility_failed,
    ]
    const code =
      gate.reasons.profile_missing.length > 0
        ? APPLY_ERROR.PROFILE_INCOMPLETE
        : gate.reasons.application_missing.includes('resume')
          ? APPLY_ERROR.RESUME_REQUIRED
          : APPLY_ERROR.APPLICATION_INSERT_FAILED
    await trackAnalyticsEvent({
      eventName: 'apply_recovery_started',
      userId: user.id,
      properties: { listing_id: listingId, code, missing: allMissing },
    })
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code, missing: allMissing },
    })
    return {
      ok: false,
      code,
      missing: allMissing,
      profile_missing: gate.reasons.profile_missing,
      application_missing: gate.reasons.application_missing,
      eligibility_failed: gate.reasons.eligibility_failed,
    }
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
  const { data: employerSettings } = await supabase
    .from('employer_settings')
    .select('default_ats_stage_mode, default_external_apply_url, default_external_apply_type')
    .eq('employer_id', String(listing.employer_id ?? ''))
    .maybeSingle()
  const employerDefaults: EmployerAtsDefaults = {
    defaultAtsStageMode: normalizeEmployerAtsDefaultMode(employerSettings?.default_ats_stage_mode),
    defaultExternalApplyUrl: employerSettings?.default_external_apply_url ?? null,
    defaultExternalApplyType: employerSettings?.default_external_apply_type === 'redirect' ? 'redirect' : 'new_tab',
  }
  const effectiveAts = resolveEffectiveAtsConfig({
    internship: {
      applyMode: listing.apply_mode,
      atsStageMode: (listing as { ats_stage_mode?: string | null }).ats_stage_mode ?? null,
      externalApplyUrl: listing.external_apply_url,
      externalApplyType: null,
      useEmployerAtsDefaults: (listing as { use_employer_ats_defaults?: boolean | null }).use_employer_ats_defaults !== false,
    },
    employerDefaults,
  })
  const shouldRequireImmediateAts = effectiveAts.requiresExternalApply && effectiveAts.atsStageMode === 'immediate'
  if (shouldRequireImmediateAts && !effectiveAts.externalApplyUrl) {
    await trackAnalyticsEvent({
      eventName: 'apply_blocked',
      userId: user.id,
      properties: { listing_id: listingId, code: APPLY_ERROR.APPLICATION_INSERT_FAILED, missing: ['external_apply_url_missing'] },
    })
    return { ok: false, code: APPLY_ERROR.APPLICATION_INSERT_FAILED }
  }

  const initialInviteStatus = shouldRequireImmediateAts ? 'invited' : 'not_invited'
  const { data: insertedApplication, error: insertError } = await supabase.rpc('submit_application_with_cap_v2', {
    in_internship_id: listingId,
    in_student_id: user.id,
    in_resume_url: resumePath,
    in_status: 'submitted',
    in_external_apply_required: shouldRequireImmediateAts,
    in_quick_apply_note: null,
    in_match_score: snapshot.match_score,
    in_match_reasons: snapshot.match_reasons,
    in_match_gaps: snapshot.match_gaps,
    in_matching_version: snapshot.matching_version,
    in_ats_invite_status: initialInviteStatus,
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
    properties: { listing_id: listingId, application_id: insertedApplicationId ?? null, apply_mode: effectiveAts.applyMode },
  })

  if (insertedApplicationId) {
    try {
      await sendEmployerApplicationAlert({ applicationId: insertedApplicationId })
    } catch {
      // no-op; email should not block application submission
    }
    const employerId = (listing as { employer_id?: string | null }).employer_id ?? null
    if (employerId) {
      try {
        await dispatchInAppNotification({
          userId: employerId,
          type: 'application_submitted',
          title: `New Quick Apply: ${String((listing as { title?: string | null }).title ?? 'Internship')}`,
          body: 'A student submitted a Quick Apply. Review in your applicant inbox.',
          href: `/dashboard/employer/applicants?internship_id=${encodeURIComponent(listingId)}`,
          metadata: { internship_id: listingId, application_id: insertedApplicationId },
        })
      } catch (notificationError) {
        console.warn('[notifications] application_submitted dispatch failed', notificationError)
      }
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
        'id, employer_id, title, majors, target_graduation_years, experience_level, hours_per_week, location, description, work_mode, term, start_date, application_deadline, role_category, required_skills, preferred_skills, recommended_coursework, apply_mode, ats_stage_mode, external_apply_url, use_employer_ats_defaults, application_cap, applications_count, resume_required, restrict_by_major, restrict_by_year, internship_required_course_categories(category_id, category:canonical_course_categories(name, slug)), internship_coursework_category_links(category_id, category:coursework_categories(name))'
      )
      .eq('id', listingId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])

  if (!listing?.id) return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND, error: 'Listing not found.' }
  if (hasDeadlinePassed(listing.application_deadline ?? null)) {
    return { ok: false, code: APPLY_ERROR.LISTING_NOT_FOUND, error: 'Applications are closed for this listing.' }
  }
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
    'school, university_id, major_id, major:canonical_majors(name), majors, year, experience_level, coursework, coursework_unverified, interests, availability_start_month, availability_hours_per_week'
  const fallbackProfileSelect =
    'school, university_id, major_id, major:canonical_majors(name), majors, year, experience_level, coursework, interests, availability_start_month, availability_hours_per_week'
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

  const gate = evaluateApplyGate({
    listing,
    profile,
    hasResume: hasUpload || Boolean(typeof user.user_metadata?.resume_path === 'string' && user.user_metadata.resume_path.trim()),
    listingId,
    userId: user.id,
  })
  if (!gate.canApply) {
    if (gate.reasons.profile_missing.length > 0) {
      return {
        ok: false,
        code: APPLY_ERROR.PROFILE_INCOMPLETE,
        profile_missing: gate.reasons.profile_missing,
        application_missing: gate.reasons.application_missing,
        eligibility_failed: gate.reasons.eligibility_failed,
        error: profileMissingMessage(gate.reasons.profile_missing),
      }
    }
    if (gate.reasons.application_missing.length > 0) {
      const needsResume = gate.reasons.application_missing.includes('resume')
      return {
        ok: false,
        code: needsResume ? APPLY_ERROR.RESUME_REQUIRED : APPLY_ERROR.APPLICATION_INSERT_FAILED,
        profile_missing: gate.reasons.profile_missing,
        application_missing: gate.reasons.application_missing,
        eligibility_failed: gate.reasons.eligibility_failed,
        error: needsResume ? 'Resume required. Upload a PDF resume to apply.' : 'Complete required application fields before applying.',
      }
    }
    return {
      ok: false,
      code: APPLY_ERROR.APPLICATION_INSERT_FAILED,
      profile_missing: gate.reasons.profile_missing,
      application_missing: gate.reasons.application_missing,
      eligibility_failed: gate.reasons.eligibility_failed,
      error: gate.reasons.eligibility_failed[0] ?? 'You are not eligible for this listing.',
    }
  }

  if (!hasUpload) {
    const existingResume = typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path.trim() : ''
    if (!existingResume && listing.resume_required !== false) {
      return {
        ok: false,
        code: APPLY_ERROR.RESUME_REQUIRED,
        application_missing: ['resume'],
        profile_missing: [],
        eligibility_failed: [],
        error: 'Resume required. Upload a PDF resume to apply.',
      }
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

  if (!resumePath && listing.resume_required !== false) {
    return { ok: false, code: APPLY_ERROR.RESUME_REQUIRED, application_missing: ['resume'], error: 'Resume required. Upload a PDF resume to apply.' }
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

  const { data: employerSettings } = await supabase
    .from('employer_settings')
    .select('default_ats_stage_mode, default_external_apply_url, default_external_apply_type')
    .eq('employer_id', String(listing.employer_id ?? ''))
    .maybeSingle()
  const employerDefaults: EmployerAtsDefaults = {
    defaultAtsStageMode: normalizeEmployerAtsDefaultMode(employerSettings?.default_ats_stage_mode),
    defaultExternalApplyUrl: employerSettings?.default_external_apply_url ?? null,
    defaultExternalApplyType: employerSettings?.default_external_apply_type === 'redirect' ? 'redirect' : 'new_tab',
  }
  const effectiveAts = resolveEffectiveAtsConfig({
    internship: {
      applyMode: listing.apply_mode,
      atsStageMode: (listing as { ats_stage_mode?: string | null }).ats_stage_mode ?? null,
      externalApplyUrl: listing.external_apply_url,
      externalApplyType: null,
      useEmployerAtsDefaults: (listing as { use_employer_ats_defaults?: boolean | null }).use_employer_ats_defaults !== false,
    },
    employerDefaults,
  })
  const shouldRequireImmediateAts = effectiveAts.requiresExternalApply && effectiveAts.atsStageMode === 'immediate'
  if (shouldRequireImmediateAts && !effectiveAts.externalApplyUrl) {
    return {
      ok: false,
      code: APPLY_ERROR.APPLICATION_INSERT_FAILED,
      error: 'This listing is missing an external apply link.',
    }
  }

  const initialInviteStatus = shouldRequireImmediateAts ? 'invited' : 'not_invited'
  const { data: insertedApplication, error: insertError } = await supabase.rpc('submit_application_with_cap_v2', {
    in_internship_id: listingId,
    in_student_id: user.id,
    in_resume_url: resumePath,
    in_status: 'submitted',
    in_external_apply_required: shouldRequireImmediateAts,
    in_quick_apply_note: screeningResponse || null,
    in_match_score: snapshot.match_score,
    in_match_reasons: snapshot.match_reasons,
    in_match_gaps: snapshot.match_gaps,
    in_matching_version: snapshot.matching_version,
    in_ats_invite_status: initialInviteStatus,
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
    const employerId = (listing as { employer_id?: string | null }).employer_id ?? null
    if (employerId) {
      try {
        await dispatchInAppNotification({
          userId: employerId,
          type: 'application_submitted',
          title: `New Quick Apply: ${String((listing as { title?: string | null }).title ?? 'Internship')}`,
          body: 'A student submitted a Quick Apply. Review in your applicant inbox.',
          href: `/dashboard/employer/applicants?internship_id=${encodeURIComponent(listingId)}`,
          metadata: { internship_id: listingId, application_id: insertedApplicationId },
        })
      } catch (notificationError) {
        console.warn('[notifications] application_submitted dispatch failed', notificationError)
      }
    }
  }

  return {
    ok: true,
    externalApplyRequired: shouldRequireImmediateAts,
    externalApplyUrl: shouldRequireImmediateAts ? (effectiveAts.externalApplyUrl || null) : null,
    successMessage: shouldRequireImmediateAts
      ? 'Application submitted successfully.'
      : 'Application sent. If the employer wants to move forward, you’ll receive an invite to complete their official application.',
  }
}
