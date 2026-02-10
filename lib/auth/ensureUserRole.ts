import 'server-only'

import { isUserRole, type AppRole, type UserRole } from '@/lib/auth/roles'
import { resolveRoleDecision, type RoleAssignmentAction } from '@/lib/auth/roleDecision'
import { supabaseServer } from '@/lib/supabase/server'

type EnsureUserRoleOptions = {
  explicitSwitch?: boolean
}

const isDev = process.env.NODE_ENV !== 'production'

function logRoleDecision(params: {
  userId: string
  currentRole: UserRole | null
  desiredRole: AppRole
  finalRole: UserRole
  actionTaken: RoleAssignmentAction
}) {
  if (!isDev) return
  console.debug('[RBAC][ensureUserRole]', params)
}

export async function ensureUserRole(
  userId: string,
  desiredRole: AppRole,
  options?: EnsureUserRoleOptions
): Promise<UserRole> {
  const explicitSwitch = options?.explicitSwitch === true
  const supabase = await supabaseServer()

  const { data: userRow, error: roleError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (roleError) {
    throw new Error(`Failed to load current role: ${roleError.message}`)
  }

  const currentRole = isUserRole(userRow?.role) ? userRow.role : null
  const decision = resolveRoleDecision({
    currentRole,
    desiredRole,
    rowExists: Boolean(userRow?.id),
    explicitSwitch,
  })

  if (decision.shouldWrite) {
    if (!userRow?.id) {
      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        role: decision.finalRole,
        verified: false,
      })
      if (insertError) {
        throw new Error(`Failed to create role row: ${insertError.message}`)
      }
    } else {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: decision.finalRole })
        .eq('id', userId)
      if (updateError) {
        throw new Error(`Failed to update role row: ${updateError.message}`)
      }
    }
  }

  logRoleDecision({
    userId,
    currentRole,
    desiredRole,
    finalRole: decision.finalRole,
    actionTaken: decision.actionTaken,
  })

  return decision.finalRole
}
