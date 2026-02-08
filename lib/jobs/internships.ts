import { supabaseServer } from '@/lib/supabase/server'

export type Internship = {
  id: string
  title: string | null
  company_name: string | null
  location: string | null
  experience_level: string | null
  majors: string[] | string | null
  hours_per_week: number | null
  pay: string | null
  created_at: string | null
}

const INTERNSHIP_SELECT =
  'id, title, company_name, location, experience_level, majors, hours_per_week, pay, created_at'

export async function fetchInternships(options?: { limit?: number }) {
  const supabase = await supabaseServer()
  let query = supabase.from('internships').select(INTERNSHIP_SELECT).order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query
  return (data ?? []) as Internship[]
}

export function formatMajors(value: Internship['majors']) {
  if (!value) return null
  if (Array.isArray(value)) return value.join(', ')
  return value
}

export function getInternshipType(hoursPerWeek: number | null) {
  return typeof hoursPerWeek === 'number' && hoursPerWeek <= 20 ? 'part-time' : 'internship'
}
