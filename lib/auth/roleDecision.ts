export type AppRole = 'student' | 'employer'
export type UserRole = 'student' | 'employer' | 'ops_admin' | 'super_admin' | 'support'

export type RoleAssignmentAction =
  | 'created'
  | 'updated'
  | 'skipped'
  | 'blocked_admin_override'
  | 'skipped_non_app_role'

export type RoleDecisionInput = {
  currentRole: UserRole | null
  desiredRole: AppRole
  rowExists: boolean
  explicitSwitch: boolean
}

export type RoleDecision = {
  finalRole: UserRole
  actionTaken: RoleAssignmentAction
  shouldWrite: boolean
}

function isAdminRoleLocal(role: UserRole) {
  return role === 'ops_admin' || role === 'super_admin'
}

function isAppRoleLocal(role: UserRole) {
  return role === 'student' || role === 'employer'
}

export function resolveRoleDecision(input: RoleDecisionInput): RoleDecision {
  const { currentRole, desiredRole, rowExists, explicitSwitch } = input

  if (currentRole && isAdminRoleLocal(currentRole)) {
    return {
      finalRole: currentRole,
      actionTaken: 'blocked_admin_override',
      shouldWrite: false,
    }
  }

  if (!rowExists) {
    return {
      finalRole: desiredRole,
      actionTaken: 'created',
      shouldWrite: true,
    }
  }

  if (!currentRole) {
    return {
      finalRole: desiredRole,
      actionTaken: 'updated',
      shouldWrite: true,
    }
  }

  if (!isAppRoleLocal(currentRole)) {
    return {
      finalRole: currentRole,
      actionTaken: 'skipped_non_app_role',
      shouldWrite: false,
    }
  }

  if (explicitSwitch && currentRole !== desiredRole) {
    return {
      finalRole: desiredRole,
      actionTaken: 'updated',
      shouldWrite: true,
    }
  }

  return {
    finalRole: currentRole,
    actionTaken: 'skipped',
    shouldWrite: false,
  }
}
