import type { UserRole } from '@/lib/auth/roles'
import { NAV_ITEMS, type NavContext, type NavItem, type NavRole } from '@/src/navigation/navConfig'
import { matchPath } from '@/src/navigation/matchPath'

export type GetNavForRoleInput = {
  role?: UserRole | NavRole | null
  pathname: string
  context: NavContext
}

export type NavSelection = {
  items: NavItem[]
  primary: NavItem[]
  secondary: NavItem[]
  activeItemId: string | null
}

export function toNavRole(role?: UserRole | NavRole | null): NavRole {
  if (role === 'student' || role === 'employer' || role === 'public') return role
  if (role === 'ops_admin' || role === 'super_admin' || role === 'support' || role === 'admin') return 'admin'
  return 'public'
}

export function getNavForRole({ role, pathname, context }: GetNavForRoleInput): NavSelection {
  const navRole = toNavRole(role)

  const items = NAV_ITEMS.filter((item) => item.roles.includes(navRole) && item.contexts.includes(context)).sort(
    (left, right) => left.order - right.order
  )

  const primary = items.filter((item) => item.group === 'primary')
  const secondary = items.filter((item) => item.group === 'secondary')
  const activeItemId = matchPath(pathname, items)

  return {
    items,
    primary,
    secondary,
    activeItemId,
  }
}
