import type { SupabaseClient } from '@supabase/supabase-js'
import {
  inferCanonicalCategorySlugFromSubject,
  inferLevelBandFromCourseNumber,
  type CourseworkLevelBand,
} from '@/lib/coursework/classification'

type MaybeRelation<T> = T | T[] | null | undefined

type StudentCourseRow = {
  course?: MaybeRelation<{
    category_id?: string | null
    subject_code?: string | null
    course_number?: string | null
    level?: string | null
    category?: MaybeRelation<{ id?: string | null; name?: string | null; slug?: string | null }>
  }>
}

export type StudentCourseworkFeatures = {
  canonicalCategoryIds: string[]
  canonicalCategoryNames: string[]
  legacyCategoryIds: string[]
  legacyItemIds: string[]
  textCoursework: string | null
  unverifiedText: string[] | null
  coverage: { hasCanonical: boolean; hasLegacy: boolean; hasText: boolean }
  canonicalCourseLevelBands: CourseworkLevelBand[]
}

function asArray<T>(value: MaybeRelation<T>) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [value]
}

function normalizeLabel(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function normalizeLevelBand(value: string | null | undefined): CourseworkLevelBand | null {
  const normalized = normalizeLabel(value).toLowerCase()
  if (normalized === 'intro') return 'intro'
  if (normalized === 'intermediate') return 'intermediate'
  if (normalized === 'advanced') return 'advanced'
  return null
}

function textCourseworkFromProfile(value: unknown) {
  if (Array.isArray(value)) {
    const rows = value.filter((item): item is string => typeof item === 'string').map(normalizeLabel).filter(Boolean)
    return rows.length > 0 ? rows.join(', ') : null
  }
  if (typeof value === 'string') {
    const normalized = normalizeLabel(value)
    return normalized.length > 0 ? normalized : null
  }
  return null
}

export async function getStudentCourseworkFeatures(params: {
  supabase: SupabaseClient
  studentId: string
  profileCoursework?: unknown
  profileCourseworkUnverified?: unknown
}): Promise<StudentCourseworkFeatures> {
  const { supabase, studentId } = params

  const [studentCoursesResult, legacyCategoryResult, legacyItemResult, fallbackProfileResult] = await Promise.all([
    supabase
      .from('student_courses')
      .select('course:canonical_courses(category_id, subject_code, course_number, level, category:canonical_course_categories(id, name, slug))')
      .eq('student_profile_id', studentId),
    supabase.from('student_coursework_category_links').select('category_id').eq('student_id', studentId),
    supabase.from('student_coursework_items').select('coursework_item_id').eq('student_id', studentId),
    params.profileCoursework !== undefined || params.profileCourseworkUnverified !== undefined
      ? Promise.resolve({
          data: [
            {
              coursework: params.profileCoursework ?? null,
              coursework_unverified: params.profileCourseworkUnverified ?? null,
            },
          ],
        })
      : supabase
          .from('student_profiles')
          .select('coursework, coursework_unverified')
          .eq('user_id', studentId)
          .limit(1),
  ])

  const studentCourses = (studentCoursesResult.data ?? []) as StudentCourseRow[]

  const directCanonicalCategoryIds = new Set<string>()
  const directCanonicalCategoryNames = new Set<string>()
  const inferredCategorySlugs = new Set<string>()
  const canonicalCourseLevelBands = new Set<CourseworkLevelBand>()

  for (const row of studentCourses) {
    for (const course of asArray(row.course)) {
      let courseHasCategory = false
      if (typeof course.category_id === 'string' && course.category_id.length > 0) {
        directCanonicalCategoryIds.add(course.category_id)
        courseHasCategory = true
      }
      for (const category of asArray(course.category)) {
        if (typeof category.id === 'string' && category.id.length > 0) {
          directCanonicalCategoryIds.add(category.id)
          courseHasCategory = true
        }
        const categoryName = normalizeLabel(category.name)
        if (categoryName) directCanonicalCategoryNames.add(categoryName)
        const slug = normalizeLabel(category.slug).toLowerCase()
        if (slug) inferredCategorySlugs.add(slug)
      }

      const explicitLevelBand = normalizeLevelBand(course.level)
      if (explicitLevelBand) {
        canonicalCourseLevelBands.add(explicitLevelBand)
      } else {
        canonicalCourseLevelBands.add(inferLevelBandFromCourseNumber(course.course_number))
      }

      if (!courseHasCategory) {
        const inferred = inferCanonicalCategorySlugFromSubject(course.subject_code)
        if (inferred) inferredCategorySlugs.add(inferred)
      }
    }
  }

  if (inferredCategorySlugs.size > 0) {
    const { data: inferredCategories } = await supabase
      .from('canonical_course_categories')
      .select('id, name, slug')
      .in('slug', Array.from(inferredCategorySlugs))

    for (const category of inferredCategories ?? []) {
      if (typeof category.id === 'string' && category.id.length > 0) {
        directCanonicalCategoryIds.add(category.id)
      }
      const categoryName = normalizeLabel(category.name)
      if (categoryName) directCanonicalCategoryNames.add(categoryName)
    }
  }

  const legacyCategoryIds = Array.from(
    new Set(
      (legacyCategoryResult.data ?? [])
        .map((row) => row.category_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const legacyItemIds = Array.from(
    new Set(
      (legacyItemResult.data ?? [])
        .map((row) => row.coursework_item_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const profileRow = (fallbackProfileResult.data ?? [])[0] as
    | { coursework?: unknown; coursework_unverified?: unknown }
    | undefined
  const textCoursework = textCourseworkFromProfile(profileRow?.coursework)
  const unverifiedText = Array.isArray(profileRow?.coursework_unverified)
    ? profileRow.coursework_unverified.filter((item): item is string => typeof item === 'string').map(normalizeLabel).filter(Boolean)
    : null

  const canonicalCategoryIds = Array.from(directCanonicalCategoryIds)
  const canonicalCategoryNames = Array.from(directCanonicalCategoryNames)

  return {
    canonicalCategoryIds,
    canonicalCategoryNames,
    legacyCategoryIds,
    legacyItemIds,
    textCoursework,
    unverifiedText: unverifiedText && unverifiedText.length > 0 ? unverifiedText : null,
    coverage: {
      hasCanonical: canonicalCategoryIds.length > 0,
      hasLegacy: legacyCategoryIds.length > 0 || legacyItemIds.length > 0,
      hasText: Boolean(textCoursework) || Boolean(unverifiedText && unverifiedText.length > 0),
    },
    canonicalCourseLevelBands: Array.from(canonicalCourseLevelBands),
  }
}
