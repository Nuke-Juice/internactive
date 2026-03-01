import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { loadTopInternshipMatchesForStudent } from '@/lib/admin/matchingPreview'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

type Params = { params: Promise<{ studentId: string }> }

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(_request: Request, { params }: Params) {
  const { studentId } = await params
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 })
  }
  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ error: 'Admin service credentials missing.' }, { status: 500 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof roleRow?.role === 'string' ? roleRow.role : null
  if (!(role && (ADMIN_ROLES as readonly string[]).includes(role))) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const result = await loadTopInternshipMatchesForStudent(admin, studentId, { limit: 5 })
  if (!result) {
    return NextResponse.json({ error: 'Student not found.' }, { status: 404 })
  }

  return NextResponse.json({
    student: {
      id: result.student.userId,
      name: result.student.name,
      email: result.student.email,
    },
    matches: result.ranked.map((item) => ({
      internshipId: item.internship.id,
      title: item.internship.title ?? 'Untitled internship',
      companyName: item.internship.companyName ?? 'Unknown employer',
      score:
        typeof item.match.breakdown?.total_score === 'number'
          ? item.match.breakdown.total_score
          : item.match.score,
      reasons: item.match.reasons.slice(0, 3),
    })),
  })
}
