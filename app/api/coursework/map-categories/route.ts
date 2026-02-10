import { NextResponse } from 'next/server'
import { mapCourseworkTextToCategories } from '@/lib/coursework/mapCourseworkCategories'
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

  const rawItems = body && typeof body === 'object' && 'items' in body ? (body as { items?: unknown }).items : []
  const items = Array.isArray(rawItems) ? rawItems.filter((item): item is string => typeof item === 'string') : []

  const mapped = await mapCourseworkTextToCategories(items)
  return NextResponse.json(mapped)
}
