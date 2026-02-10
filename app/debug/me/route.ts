import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { isUserRole } from '@/lib/auth/roles'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ auth_user_id: null, email: null, role: null }, { status: 401 })
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = isUserRole(userRow?.role) ? userRow.role : null

  return NextResponse.json({
    auth_user_id: user.id,
    email: user.email ?? null,
    role,
  })
}
