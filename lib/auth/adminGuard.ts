import type { UserRole } from './roles'

export type AdminAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unauthenticated' | 'forbidden' }

const ADMIN_ROLE_SET: ReadonlySet<UserRole> = new Set(['ops_admin', 'super_admin'])

export function decideAdminAccess(role: UserRole | null | undefined): AdminAccessDecision {
  if (!role) return { allowed: false, reason: 'unauthenticated' }
  if (ADMIN_ROLE_SET.has(role)) return { allowed: true }
  return { allowed: false, reason: 'forbidden' }
}
