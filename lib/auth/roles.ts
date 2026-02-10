export const USER_ROLES = ['student', 'employer', 'ops_admin', 'super_admin', 'support'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const ADMIN_ROLES = ['ops_admin', 'super_admin'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const APP_ROLES = ['student', 'employer'] as const
export type AppRole = (typeof APP_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value)
}
