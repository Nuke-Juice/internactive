import { supabaseServer } from '@/lib/supabase/server'
import { searchCanonicalSkills } from '@/lib/skills/resolveSkillSelections'
import { jsonError, jsonOk } from '@/src/server/api/respond'
import { clampInt } from '@/src/server/api/validate'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = String(searchParams.get('q') ?? '')
  const limit = clampInt(searchParams.get('limit') ?? 20, { min: 5, max: 20, fallback: 20 })

  try {
    const supabase = await supabaseServer()
    const options = await searchCanonicalSkills({ supabase, query, limit })
    return jsonOk({ options })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Skill search failed.'
    return jsonError(message, 500)
  }
}
