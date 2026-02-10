import { NextResponse } from 'next/server'
import { normalizeCoursework } from '@/lib/coursework/normalizeCoursework'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawCoursework =
    body && typeof body === 'object' && 'coursework' in body ? (body as { coursework?: unknown }).coursework : []
  const coursework = Array.isArray(rawCoursework)
    ? rawCoursework.filter((item): item is string => typeof item === 'string')
    : []

  const normalized = await normalizeCoursework(coursework)
  return NextResponse.json(normalized)
}
