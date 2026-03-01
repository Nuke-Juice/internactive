import { NextResponse } from 'next/server'
import { isUserRole } from '@/lib/auth/roles'
import { isPilotMode } from '@/lib/pilotMode'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      {
        pilotMode: isPilotMode(),
        authenticated: false,
      },
      { status: 401 }
    )
  }

  const [{ data: userRow }, { data: studentProfile }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).maybeSingle<{ role?: string | null }>(),
    supabase
      .from('student_profiles')
      .select('user_id, concierge_opt_in, concierge_intake_completed_at')
      .eq('user_id', user.id)
      .maybeSingle<{
        user_id?: string | null
        concierge_opt_in?: boolean | null
        concierge_intake_completed_at?: string | null
      }>(),
  ])

  const metadataRole = user.app_metadata?.role ?? user.user_metadata?.role
  const resolvedRole = isUserRole(userRow?.role) ? userRow.role : isUserRole(metadataRole) ? metadataRole : null

  return NextResponse.json({
    pilotMode: isPilotMode(),
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
      appMetadataRole: user.app_metadata?.role ?? null,
      userMetadataRole: user.user_metadata?.role ?? null,
    },
    resolvedRole,
    studentProfileExists: !!studentProfile,
    studentProfile: studentProfile
      ? {
          concierge_opt_in: studentProfile.concierge_opt_in ?? null,
          concierge_intake_completed_at: studentProfile.concierge_intake_completed_at ?? null,
        }
      : null,
  })
}
