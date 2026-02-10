import { supabaseServer } from '@/lib/supabase/server'
import { isAppRole, type AppRole } from '@/lib/auth/roles'

type HeaderContext = {
  isAuthenticated: boolean
  role?: AppRole
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

  if (isAppRole(role)) {
    return { isAuthenticated: true, role }
  }

  return { isAuthenticated: true }
}
