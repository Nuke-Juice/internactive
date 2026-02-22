import type { SupabaseClient } from '@supabase/supabase-js'
import { getStudentCourseworkFeatures, type StudentCourseworkFeatures } from '@/lib/coursework/getStudentCourseworkFeatures'
import { parseStudentPreferenceSignals } from '@/lib/student/preferenceSignals'
import { computeProfileCompleteness, type CanonicalProfileCompletenessResult, type ProfileCompletenessInput } from '@/src/profile/profileCompleteness'

type GetStudentProfileCompletenessParams = {
  supabase: SupabaseClient
  userId: string
  preloaded?: {
    profile?: ProfileCompletenessInput | null
    resumeUploaded?: boolean
    resumePath?: string | null
    skillsCount?: number
    courseworkFeatures?: Pick<StudentCourseworkFeatures, 'courseCount' | 'canonicalCategoryIds' | 'textCoursework' | 'unverifiedText'>
  }
}

type StudentProfileRow = ProfileCompletenessInput & {
  major?: { id?: string | null; name?: string | null } | Array<{ id?: string | null; name?: string | null }> | null
  coursework?: unknown
  coursework_unverified?: unknown
}

function uniqCount(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)).size
}

function isStudentProfileSchemaDrift(message: string | null | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('schema cache') || (normalized.includes('column') && normalized.includes('student_profiles'))
}

function normalizeProfileRow(profile: StudentProfileRow | null): StudentProfileRow | null {
  if (!profile) return null
  const joinedMajor =
    Array.isArray(profile.major)
      ? profile.major.find((item) => typeof item?.name === 'string' && item.name.trim().length > 0)
      : profile.major
  const joinedMajorName = typeof joinedMajor?.name === 'string' ? joinedMajor.name.trim() : ''
  const mergedMajors = Array.isArray(profile.majors)
    ? profile.majors.map((item) => String(item).trim()).filter(Boolean)
    : typeof profile.majors === 'string' && profile.majors.trim().length > 0
      ? [profile.majors.trim()]
      : []
  if (joinedMajorName && !mergedMajors.some((item) => item.toLowerCase() === joinedMajorName.toLowerCase())) {
    mergedMajors.unshift(joinedMajorName)
  }

  return {
    ...profile,
    majors: mergedMajors.length > 0 ? mergedMajors : profile.majors,
  }
}

async function fetchProfileForCompleteness(params: {
  supabase: SupabaseClient
  userId: string
}): Promise<StudentProfileRow | null> {
  // Canonical profile fields mirror `/account` student profile fetch so completeness
  // reflects exactly what the account UI considers saved profile data.
  const fullSelect =
    'major_id, major:canonical_majors(id, name), majors, interests, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, max_commute_minutes, coursework, coursework_unverified'
  const fallbackSelect =
    'major_id, major:canonical_majors(id, name), majors, interests, availability_start_month, availability_hours_per_week, preferred_city, preferred_state, max_commute_minutes, coursework'

  const fullResult = await params.supabase
    .from('student_profiles')
    .select(fullSelect)
    .eq('user_id', params.userId)
    .maybeSingle<StudentProfileRow>()

  if (!fullResult.error) {
    return normalizeProfileRow(fullResult.data ?? null)
  }

  if (!isStudentProfileSchemaDrift(fullResult.error.message)) {
    return null
  }

  const fallbackResult = await params.supabase
    .from('student_profiles')
    .select(fallbackSelect)
    .eq('user_id', params.userId)
    .maybeSingle<StudentProfileRow>()

  return normalizeProfileRow(fallbackResult.data ?? null)
}

export async function getStudentProfileCompleteness({
  supabase,
  userId,
  preloaded,
}: GetStudentProfileCompletenessParams): Promise<CanonicalProfileCompletenessResult> {
  const [profileResult, studentProfileSkillsResult, studentLegacySkillsResult, resumeResult] = await Promise.all([
    preloaded?.profile
      ? Promise.resolve({
          data: {
            ...preloaded.profile,
            coursework: null,
            coursework_unverified: null,
          } as StudentProfileRow,
        })
      : fetchProfileForCompleteness({ supabase, userId }).then((data) => ({ data })),
    preloaded?.skillsCount !== undefined
      ? Promise.resolve({ data: [] as Array<{ canonical_skill_id: string | null; custom_skill_id: string | null }> })
      : supabase.from('student_profile_skills').select('canonical_skill_id, custom_skill_id').eq('student_id', userId),
    preloaded?.skillsCount !== undefined
      ? Promise.resolve({ data: [] as Array<{ skill_id: string | null }> })
      : supabase.from('student_skill_items').select('skill_id').eq('student_id', userId),
    preloaded?.resumeUploaded !== undefined
      ? Promise.resolve({ data: { id: preloaded.resumeUploaded ? 'preloaded' : null } as { id: string | null } })
      : supabase
          .from('student_resume_files')
          .select('id')
          .eq('user_id', userId)
          .eq('latest_version', true)
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>(),
  ])

  const profile = normalizeProfileRow((profileResult.data ?? null) as StudentProfileRow | null)

  const courseworkFeatures =
    preloaded?.courseworkFeatures ??
    (await getStudentCourseworkFeatures({
      supabase,
      studentId: userId,
      profileCoursework: profile?.coursework,
      profileCourseworkUnverified: profile?.coursework_unverified,
    }))

  const skillsCount =
    preloaded?.skillsCount ??
    uniqCount([
      ...(studentProfileSkillsResult.data ?? []).flatMap((row) => [row.canonical_skill_id, row.custom_skill_id]),
      ...(studentLegacySkillsResult.data ?? []).map((row) => row.skill_id),
    ])
  const parsedPreferenceSkills = parseStudentPreferenceSignals(profile?.interests ?? null).skills.length
  const effectiveSkillsCount = Math.max(skillsCount, parsedPreferenceSkills)
  const legacyCourseworkCount =
    courseworkFeatures.courseCount > 0
      ? courseworkFeatures.courseCount
      : courseworkFeatures.textCoursework || (courseworkFeatures.unverifiedText?.length ?? 0) > 0
        ? 1
        : 0
  const hasLegacyResumePath = typeof preloaded?.resumePath === 'string' && preloaded.resumePath.trim().length > 0

  const result = computeProfileCompleteness(profile, {
    resumeUploaded: (preloaded?.resumeUploaded ?? Boolean(resumeResult.data?.id)) || hasLegacyResumePath,
    skillsCount: effectiveSkillsCount,
    courseworkCount: legacyCourseworkCount,
    derivedCourseworkCategoryCount: courseworkFeatures.canonicalCategoryIds.length,
  })

  if (process.env.NODE_ENV !== 'production' && result.percent < 50) {
    console.debug('[profile_completeness] unusually_low', {
      userId,
      percent: result.percent,
      profileInputs: {
        major_id: profile?.major_id ?? null,
        majors: profile?.majors ?? null,
        availability_start_month: profile?.availability_start_month ?? null,
        availability_hours_per_week: profile?.availability_hours_per_week ?? null,
        preferred_city: profile?.preferred_city ?? null,
        preferred_state: profile?.preferred_state ?? null,
        max_commute_minutes: profile?.max_commute_minutes ?? null,
      },
      derivedInputs: {
        resumeUploaded: (preloaded?.resumeUploaded ?? Boolean(resumeResult.data?.id)) || hasLegacyResumePath,
        skillsCount: effectiveSkillsCount,
        courseCount: legacyCourseworkCount,
        derivedCourseworkCategoryCount: courseworkFeatures.canonicalCategoryIds.length,
      },
      missing: result.missing.map((item) => item.key),
    })
  }

  return result
}
