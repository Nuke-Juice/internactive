import { supabaseServer } from '@/lib/supabase/server'

type HeaderRole = 'student' | 'employer'

type HeaderContext = {
  isAuthenticated: boolean
  role?: HeaderRole
}

export async function getHeaderContext(): Promise<HeaderContext> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAuthenticated: false }
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = userRow?.role

  if (role === 'student' || role === 'employer') {
    return { isAuthenticated: true, role }
  }

  return { isAuthenticated: true }
}
