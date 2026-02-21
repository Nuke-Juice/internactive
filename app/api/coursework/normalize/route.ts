import { normalizeCoursework } from '@/lib/coursework/normalizeCoursework'
import { supabaseServer } from '@/lib/supabase/server'
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

  const coursework = getArrayField(parsed.body, 'coursework')

  const normalized = await normalizeCoursework(coursework)
  return jsonOk(normalized)
}
