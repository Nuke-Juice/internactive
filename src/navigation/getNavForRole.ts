import type { UserRole } from '@/lib/auth/roles'
import { isPilotMode } from '@/lib/pilotMode'
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
  const items = selectNavItems({ navRole, pathname, context })

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

function selectNavItems(input: { navRole: NavRole; pathname: string; context: NavContext }) {
  const baseItems = NAV_ITEMS.filter((item) => item.roles.includes(input.navRole) && item.contexts.includes(input.context))

  if (input.navRole === 'admin' && input.context === 'admin' && isPilotMode()) {
    return baseItems
      .filter((item) => item.id !== 'admin-queue' && item.id !== 'admin-analytics')
      .map((item) => {
        switch (item.id) {
          case 'admin-dashboard':
            return {
              ...item,
              label: 'Pilot Home',
              order: 10,
              hint: 'Founder workflow',
            }
          case 'admin-students':
            return {
              ...item,
              label: 'Concierge pool',
              order: 20,
              hint: 'Students in the pool',
            }
          case 'admin-pilot-review':
            return {
              ...item,
              label: 'Candidate packs',
              order: 30,
              hint: 'Shortlists + handoff',
            }
          case 'admin-employers':
            return {
              ...item,
              order: 40,
            }
          case 'admin-listings':
            return {
              ...item,
              order: 50,
            }
          case 'admin-tools':
            return {
              ...item,
              order: 60,
              activeOn: ['/admin/listings-queue', '/admin/matching/preview', '/admin/matching/report'],
            }
          default:
            return item
        }
      })
      .sort((left, right) => left.order - right.order)
  }

  return baseItems.sort((left, right) => left.order - right.order)
}
