type MaybeRelation<T> = T | T[] | null | undefined

type CanonicalCategoryLink = {
  category_id?: string | null
  category?: MaybeRelation<{ id?: string | null; name?: string | null; slug?: string | null }>
}

type LegacyCategoryLink = {
  category_id?: string | null
  category?: MaybeRelation<{ id?: string | null; name?: string | null; normalized_name?: string | null }>
}

type LegacyItemLink = {
  coursework_item_id?: string | null
  coursework?: MaybeRelation<{ id?: string | null; name?: string | null; normalized_name?: string | null }>
}

export type ListingCourseworkNormalizationInput = {
  internship_required_course_categories?: CanonicalCategoryLink[] | null
  internship_coursework_category_links?: LegacyCategoryLink[] | null
  internship_coursework_items?: LegacyItemLink[] | null
}

export type NormalizedListingCoursework = {
  requiredCanonicalCategoryIds: string[]
  requiredCanonicalCategoryNames: string[]
  legacyCategoryIds: string[]
  legacyCategoryNames: string[]
  legacyItemIds: string[]
  legacyItemNames: string[]
  hasAnyCourseworkRequirement: boolean
}

function asArray<T>(value: MaybeRelation<T>) {
  if (Array.isArray(value)) return value
  if (!value) return []
  return [value]
}

function normalizeLabel(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function normalizeListingCoursework(input: ListingCourseworkNormalizationInput): NormalizedListingCoursework {
  const requiredCanonicalCategoryIds = Array.from(
    new Set(
      (input.internship_required_course_categories ?? [])
        .map((row) => row.category_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const requiredCanonicalCategoryNames = Array.from(
    new Set(
      (input.internship_required_course_categories ?? [])
        .flatMap((row) => asArray(row.category))
        .map((category) => normalizeLabel(category.name))
        .filter(Boolean)
    )
  )

  const legacyCategoryIds = Array.from(
    new Set(
      (input.internship_coursework_category_links ?? [])
        .map((row) => row.category_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const legacyCategoryNames = Array.from(
    new Set(
      (input.internship_coursework_category_links ?? [])
        .flatMap((row) => asArray(row.category))
        .map((category) => normalizeLabel(category.name))
        .filter(Boolean)
    )
  )

  const legacyItemIds = Array.from(
    new Set(
      (input.internship_coursework_items ?? [])
        .map((row) => row.coursework_item_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  )

  const legacyItemNames = Array.from(
    new Set(
      (input.internship_coursework_items ?? [])
        .flatMap((row) => asArray(row.coursework))
        .map((coursework) => normalizeLabel(coursework.name))
        .filter(Boolean)
    )
  )

  return {
    requiredCanonicalCategoryIds,
    requiredCanonicalCategoryNames,
    legacyCategoryIds,
    legacyCategoryNames,
    legacyItemIds,
    legacyItemNames,
    hasAnyCourseworkRequirement:
      requiredCanonicalCategoryIds.length > 0 ||
      legacyCategoryIds.length > 0 ||
      legacyItemIds.length > 0,
  }
}
