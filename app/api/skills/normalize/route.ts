import { supabaseServer } from '@/lib/supabase/server'
import { normalizeSkills } from '@/lib/skills/normalizeSkills'
import { parseJsonBody } from '@/src/server/api/parseJson'
import { jsonError, jsonOk } from '@/src/server/api/respond'
import { getArrayField } from '@/src/server/api/validate'

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonError('Unauthorized', 401)
  }

  const parsed = await parseJsonBody(request)
  if (!parsed.ok) return parsed.response

  const skills = getArrayField(parsed.body, 'skills')

  const normalized = await normalizeSkills(skills)
  return jsonOk(normalized)
}
