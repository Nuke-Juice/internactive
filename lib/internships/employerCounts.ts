import type { SupabaseClient } from '@supabase/supabase-js'

export type EmployerInternshipCountRow = {
  id?: string | null
  is_active: boolean | null
  status?: string | null
}

export function isEmployerInternshipActive(row: EmployerInternshipCountRow) {
  return row.is_active === true
}

export function countEmployerActiveInternships(rows: EmployerInternshipCountRow[]) {
  return rows.filter(isEmployerInternshipActive).length
}

export type EmployerInternshipRow = {
  id: string
  employer_id: string | null
  title: string | null
  location: string | null
  location_city?: string | null
  location_state?: string | null
  target_student_years: string[] | null
  target_student_year: string | null
  target_graduation_years?: string[] | null
  majors: unknown
  required_skills?: string[] | null
  preferred_skills?: string[] | null
  required_course_category_ids?: string[] | null
  internship_required_course_categories?: Array<{
    category_id?: string | null
    category?: { name?: string | null } | null
  }> | null
  term?: string | null
  hours_min?: number | null
  hours_max?: number | null
  hours_per_week?: number | null
  created_at: string
  updated_at: string | null
  is_active: boolean | null
  status: 'draft' | 'published' | 'archived' | string | null
  work_mode: string | null
}

export type EmployerInternshipCounts = {
  activeCount: number
  totalCount: number
}

export function summarizeEmployerInternshipCounts(rows: EmployerInternshipCountRow[]): EmployerInternshipCounts {
  return {
    activeCount: countEmployerActiveInternships(rows),
    totalCount: rows.length,
  }
}

export async function getEmployerInternshipCounts(
  supabase: SupabaseClient,
  employerUserId: string
): Promise<EmployerInternshipCounts> {
  const { data, error } = await supabase
    .from('internships')
    .select('id, is_active')
    .eq('employer_id', employerUserId)

  if (error) {
    throw new Error(`[employer.internships.count_failed] employer_id=${employerUserId} message=${error.message}`)
  }

  return summarizeEmployerInternshipCounts((data ?? []) as EmployerInternshipCountRow[])
}

export async function getEmployerInternships(
  supabase: SupabaseClient,
  employerUserId: string
): Promise<EmployerInternshipRow[]> {
  const { data, error } = await supabase
    .from('internships')
    .select('*, internship_required_course_categories(category_id, category:canonical_course_categories(name))')
    .eq('employer_id', employerUserId)
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`[employer.internships.query_failed] employer_id=${employerUserId} message=${error.message}`)
  }
  return (data ?? []) as EmployerInternshipRow[]
}
