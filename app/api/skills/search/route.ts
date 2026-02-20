import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { searchCanonicalSkills } from '@/lib/skills/resolveSkillSelections'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = String(searchParams.get('q') ?? '')
  const rawLimit = Number(searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20

  try {
    const supabase = await supabaseServer()
    const options = await searchCanonicalSkills({ supabase, query, limit })
    return NextResponse.json({ options })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Skill search failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
