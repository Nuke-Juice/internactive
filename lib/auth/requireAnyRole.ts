import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { logAccessDecision, logRoleLookupWarning } from '@/lib/auth/devAccessLog'
import { isUserRole, type UserRole } from '@/lib/auth/roles'

type RequireAnyRoleOptions = {
  requestedPath?: string
  unauthorizedRedirectTo?: '/' | '/unauthorized'
}

export async function requireAnyRole<T extends UserRole>(roles: readonly T[], options?: RequireAnyRoleOptions) {
  const requestedPath = options?.requestedPath ?? '/admin'
  const unauthorizedRedirectTo = options?.unauthorizedRedirectTo ?? '/unauthorized'
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    logAccessDecision({
      requestedPath,
      authUserId: null,
      role: null,
      decision: 'denied',
    })
    redirect('/login')
  }

  let role: UserRole | null = null
  try {
    const { data: userRow, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (roleError) {
      logRoleLookupWarning({
        requestedPath,
        authUserId: data.user.id,
        warning: roleError.message,
      })
    } else if (isUserRole(userRow?.role)) {
      role = userRow.role
    }
  } catch (lookupError) {
    const warning = lookupError instanceof Error ? lookupError.message : 'unknown role lookup failure'
    logRoleLookupWarning({
      requestedPath,
      authUserId: data.user.id,
      warning,
    })
  }

  const isAllowed = role !== null && roles.includes(role as T)
  logAccessDecision({
    requestedPath,
    authUserId: data.user.id,
    role,
    decision: isAllowed ? 'granted' : 'denied',
  })

  if (!isAllowed) {
    redirect(unauthorizedRedirectTo)
  }

  return { user: data.user, role: role as T }
}
