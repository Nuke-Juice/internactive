import { supabaseServer } from '@/lib/supabase/server'

export type Internship = {
  id: string
  title: string | null
  company_name: string | null
  employer_id: string | null
  employer_verification_tier: 'free' | 'starter' | 'pro' | string | null
  location: string | null
  location_city: string | null
  location_state: string | null
  location_zip: string | null
  location_lat: number | null
  location_lng: number | null
  location_source: 'employer' | 'override' | string | null
  description: string | null
  short_summary: string | null
  remote_eligibility: string | null
  experience_level: string | null
  role_category: string | null
  category: string | null
  work_mode: 'remote' | 'hybrid' | 'on-site' | string | null
  term: string | null
  hours_min: number | null
  hours_max: number | null
  required_skills: string[] | null
  preferred_skills: string[] | null
  recommended_coursework: string[] | null
  target_graduation_years: string[] | null
  internship_required_skill_items:
    | Array<{
        skill_id: string
        skill: {
          id: string
          slug: string
          label: string
          category: string
        } | Array<{
          id: string
          slug: string
          label: string
          category: string
        }> | null
      }>
    | null
  internship_preferred_skill_items:
    | Array<{
        skill_id: string
        skill: {
          id: string
          slug: string
          label: string
          category: string
        } | Array<{
          id: string
          slug: string
          label: string
          category: string
        }> | null
      }>
    | null
  internship_coursework_items:
    | Array<{
        coursework_item_id: string
        coursework: {
          id: string
          name: string
          normalized_name: string
        } | Array<{
          id: string
          name: string
          normalized_name: string
        }> | null
      }>
    | null
  internship_coursework_category_links:
    | Array<{
        category_id: string
        category: {
          id: string
          name: string
          normalized_name: string
        } | Array<{
          id: string
          name: string
          normalized_name: string
        }> | null
      }>
    | null
  required_skill_ids: string[]
  preferred_skill_ids: string[]
  coursework_item_ids: string[]
  coursework_category_ids: string[]
  coursework_category_names: string[]
  resume_required: boolean | null
  application_deadline: string | null
  apply_deadline: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  pay: string | null
  created_at: string | null
  is_active: boolean | null
  source: 'concierge' | 'employer_self' | 'partner' | string | null
}

const INTERNSHIP_SELECT =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, short_summary, remote_eligibility, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, internship_required_skill_items(skill_id, skill:skills(id, slug, label, category)), internship_preferred_skill_items(skill_id, skill:skills(id, slug, label, category)), internship_coursework_items(coursework_item_id, coursework:coursework_items(id, name, normalized_name)), internship_coursework_category_links(category_id, category:coursework_categories(id, name, normalized_name)), resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'
const INTERNSHIP_SELECT_BASE =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, short_summary, remote_eligibility, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'
const INTERNSHIP_SELECT_LEGACY =
  'id, title, company_name, employer_id, employer_verification_tier, location, location_city, location_state, description, experience_level, role_category, category, work_mode, term, hours_min, hours_max, required_skills, preferred_skills, recommended_coursework, target_graduation_years, resume_required, application_deadline, apply_deadline, majors, hours_per_week, pay, created_at, is_active, source'

type InternshipFilters = {
  searchQuery?: string
  category?: string
  remoteOnly?: boolean
  experience?: string
  locationCity?: string
  locationState?: string
}

type FetchInternshipsOptions = {
  limit?: number
  page?: number
  filters?: InternshipFilters
}

function escapeIlikeInput(value: string) {
  return value.replace(/[%_]/g, '').trim()
}

export async function fetchInternships(options?: FetchInternshipsOptions) {
  const supabase = await supabaseServer()
  const today = new Date().toISOString().slice(0, 10)
  const rawLimit = Number(options?.limit ?? 60)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 120) : 60
  const rawPage = Number(options?.page ?? 1)
  const page = Number.isFinite(rawPage) ? Math.max(Math.trunc(rawPage), 1) : 1
  const start = (page - 1) * limit
  const end = start + limit
  const filters = options?.filters

  let query = supabase
    .from('internships')
    .select(INTERNSHIP_SELECT)
    .eq('is_active', true)
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order('created_at', { ascending: false })
    .range(start, end)

  const searchQuery = escapeIlikeInput(filters?.searchQuery ?? '')
  if (searchQuery.length >= 2) {
    const prefix = `${searchQuery}%`
    query = query.or(
      `title.ilike.${prefix},company_name.ilike.${prefix},category.ilike.${prefix},role_category.ilike.${prefix}`
    )
  }
  if (filters?.category?.trim()) {
    const normalizedCategory = filters.category.trim()
    query = query.or(`category.eq.${normalizedCategory},role_category.eq.${normalizedCategory}`)
  }
  if (filters?.remoteOnly) {
    query = query.eq('work_mode', 'remote')
  }
  if (filters?.experience?.trim()) {
    query = query.eq('experience_level', filters.experience.trim())
  }
  if (filters?.locationState?.trim()) {
    query = query.eq('location_state', filters.locationState.trim())
  }
  const locationCity = escapeIlikeInput(filters?.locationCity ?? '')
  if (locationCity.length >= 2) {
    query = query.ilike('location_city', `${locationCity}%`)
  }

  const { data, error } = await query
  let rows =
    (data ?? []) as unknown as Array<
      Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
    >

  if (error) {
    console.error('[jobs] fetchInternships rich query failed; retrying with base fields', error.message)
    let fallbackQuery = supabase
      .from('internships')
      .select(INTERNSHIP_SELECT_BASE)
      .eq('is_active', true)
      .or(`application_deadline.is.null,application_deadline.gte.${today}`)
      .order('created_at', { ascending: false })
      .range(start, end)

    if (searchQuery.length >= 2) {
      const prefix = `${searchQuery}%`
      fallbackQuery = fallbackQuery.or(
        `title.ilike.${prefix},company_name.ilike.${prefix},category.ilike.${prefix},role_category.ilike.${prefix}`
      )
    }
    if (filters?.category?.trim()) {
      const normalizedCategory = filters.category.trim()
      fallbackQuery = fallbackQuery.or(`category.eq.${normalizedCategory},role_category.eq.${normalizedCategory}`)
    }
    if (filters?.remoteOnly) {
      fallbackQuery = fallbackQuery.eq('work_mode', 'remote')
    }
    if (filters?.experience?.trim()) {
      fallbackQuery = fallbackQuery.eq('experience_level', filters.experience.trim())
    }
    if (filters?.locationState?.trim()) {
      fallbackQuery = fallbackQuery.eq('location_state', filters.locationState.trim())
    }
    if (locationCity.length >= 2) {
      fallbackQuery = fallbackQuery.ilike('location_city', `${locationCity}%`)
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) {
      console.error('[jobs] fetchInternships base query failed', fallbackError.message)

      const missingColumn = fallbackError.message.toLowerCase().includes('does not exist')
      if (!missingColumn) {
        return { rows: [], hasMore: false }
      }

      let legacyQuery = supabase
        .from('internships')
        .select(INTERNSHIP_SELECT_LEGACY)
        .eq('is_active', true)
        .or(`application_deadline.is.null,application_deadline.gte.${today}`)
        .order('created_at', { ascending: false })
        .range(start, end)

      if (searchQuery.length >= 2) {
        const prefix = `${searchQuery}%`
        legacyQuery = legacyQuery.or(
          `title.ilike.${prefix},company_name.ilike.${prefix},category.ilike.${prefix},role_category.ilike.${prefix}`
        )
      }
      if (filters?.category?.trim()) {
        const normalizedCategory = filters.category.trim()
        legacyQuery = legacyQuery.or(`category.eq.${normalizedCategory},role_category.eq.${normalizedCategory}`)
      }
      if (filters?.remoteOnly) {
        legacyQuery = legacyQuery.eq('work_mode', 'remote')
      }
      if (filters?.experience?.trim()) {
        legacyQuery = legacyQuery.eq('experience_level', filters.experience.trim())
      }
      if (filters?.locationState?.trim()) {
        legacyQuery = legacyQuery.eq('location_state', filters.locationState.trim())
      }
      if (locationCity.length >= 2) {
        legacyQuery = legacyQuery.ilike('location_city', `${locationCity}%`)
      }

      const { data: legacyData, error: legacyError } = await legacyQuery
      if (legacyError) {
        console.error('[jobs] fetchInternships legacy query failed', legacyError.message)
        return { rows: [], hasMore: false }
      }

      rows =
        (legacyData ?? []) as unknown as Array<
          Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
        >
      const mappedRows = rows.map((row) => ({
        ...row,
        short_summary: row.short_summary ?? null,
        remote_eligibility: row.remote_eligibility ?? null,
        required_skill_ids: (row.internship_required_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((item): item is string => typeof item === 'string'),
        preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
          .map((item) => item.skill_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_item_ids: (row.internship_coursework_items ?? [])
          .map((item) => item.coursework_item_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_category_ids: (row.internship_coursework_category_links ?? [])
          .map((item) => item.category_id)
          .filter((item): item is string => typeof item === 'string'),
        coursework_category_names: (row.internship_coursework_category_links ?? [])
          .map((item) => {
            const category = item.category as { name?: string | null } | Array<{ name?: string | null }> | null
            if (Array.isArray(category)) return typeof category[0]?.name === 'string' ? category[0].name : ''
            return typeof category?.name === 'string' ? category.name : ''
          })
          .filter((item): item is string => typeof item === 'string' && item.length > 0),
      }))
      return {
        rows: mappedRows.slice(0, limit),
        hasMore: mappedRows.length > limit,
      }
    }

    rows =
      (fallbackData ?? []) as unknown as Array<
        Omit<Internship, 'required_skill_ids' | 'preferred_skill_ids' | 'coursework_item_ids' | 'coursework_category_ids' | 'coursework_category_names'>
      >
  }

  const mappedRows = rows.map((row) => ({
    ...row,
    short_summary: row.short_summary ?? null,
    remote_eligibility: row.remote_eligibility ?? null,
    required_skill_ids: (row.internship_required_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
    preferred_skill_ids: (row.internship_preferred_skill_items ?? [])
      .map((item) => item.skill_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_item_ids: (row.internship_coursework_items ?? [])
      .map((item) => item.coursework_item_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_category_ids: (row.internship_coursework_category_links ?? [])
      .map((item) => item.category_id)
      .filter((item): item is string => typeof item === 'string'),
    coursework_category_names: (row.internship_coursework_category_links ?? [])
      .map((item) => {
        const category = item.category as { name?: string | null } | Array<{ name?: string | null }> | null
        if (Array.isArray(category)) return typeof category[0]?.name === 'string' ? category[0].name : ''
        return typeof category?.name === 'string' ? category.name : ''
      })
      .filter((item): item is string => typeof item === 'string' && item.length > 0),
  }))

  return {
    rows: mappedRows.slice(0, limit),
    hasMore: mappedRows.length > limit,
  }
}

export function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export function getInternshipType(hoursPerWeek: number | null) {
  return typeof hoursPerWeek === 'number' && hoursPerWeek <= 20 ? 'part-time' : 'internship'
}
