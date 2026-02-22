'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Briefcase,
  FileText,
  Home,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { UserRole } from '@/lib/auth/roles'
import { getNavForRole, toNavRole } from '@/src/navigation/getNavForRole'
import { matchPath } from '@/src/navigation/matchPath'
import type { NavContext, NavItem, NavMatchMode, NavRole } from '@/src/navigation/navConfig'

export type AppNavItem = {
  id: string
  label: string
  href: string
  order?: number
  match?: NavMatchMode
  activeOn?: string[]
  icon?: ComponentType<{ className?: string }>
  hint?: string
}

type Props = {
  role?: UserRole | NavRole | null
  variant: 'top' | 'workspaceTabs' | 'adminSidebar'
  items?: AppNavItem[]
  pathname?: string
  className?: string
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  applications: FileText,
  listings: Briefcase,
  inbox: Mail,
  analytics: BarChart3,
  settings: ShieldCheck,
  queue: FileText,
  employers: Mail,
  students: Users,
  home: Home,
  upgrade: ShieldCheck,
}

function normalizeItems(items: AppNavItem[]) {
  return items
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((item) => ({
      ...item,
      order: item.order ?? 0,
    }))
}

function topItemClasses(active: boolean) {
  return active
    ? 'inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700'
    : 'inline-flex h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50'
}

function workspaceItemClasses(active: boolean) {
  return `inline-flex h-12 items-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-sm transition ${
    active
      ? 'border-blue-300 bg-blue-600 text-white'
      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
  }`
}

function adminItemClasses(active: boolean) {
  return `group inline-flex min-w-[150px] items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
    active
      ? 'border-blue-300 bg-blue-50 text-blue-800'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  }`
}

function toOverrideAsNavItems(items: AppNavItem[]): NavItem[] {
  return items.map((item, index) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    roles: ['public'],
    group: 'primary',
    contexts: ['workspace'],
    order: item.order ?? index,
    match: item.match ?? 'prefix',
    activeOn: item.activeOn,
  }))
}

function resolveIcon(item: AppNavItem | NavItem) {
  if (typeof item.icon === 'string') {
    return ICONS[item.icon] ?? LayoutDashboard
  }
  if (item.icon) return item.icon
  return LayoutDashboard
}

export default function AppNav({ role, variant, items, pathname, className }: Props) {
  const currentPathname = usePathname()
  const router = useRouter()
  const resolvedPathname = pathname ?? currentPathname ?? '/'

  const context: NavContext = variant === 'top' ? 'top' : variant === 'adminSidebar' ? 'admin' : 'workspace'

  const builtFromConfig = getNavForRole({ role: toNavRole(role), pathname: resolvedPathname, context })
  const overrideItems = items ? normalizeItems(items) : null
  const configuredItems = overrideItems ?? builtFromConfig.primary

  const asNavItems = overrideItems ? toOverrideAsNavItems(overrideItems) : builtFromConfig.primary
  const activeItemId = matchPath(resolvedPathname, asNavItems)

  if (configuredItems.length === 0) return null

  if (variant === 'adminSidebar') {
    const activeHref = configuredItems.find((item) => item.id === activeItemId)?.href ?? configuredItems[0]?.href

    return (
      <div className={className ?? ''}>
        <div className="md:hidden">
          <label htmlFor="admin-route" className="sr-only">
            Jump to admin section
          </label>
          <select
            id="admin-route"
            value={activeHref}
            onChange={(event) => router.push(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700"
          >
            {configuredItems.map((item) => (
              <option key={item.id} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden gap-2 overflow-x-auto pb-0.5 md:flex">
          {configuredItems.map((item) => {
            const Icon = resolveIcon(item)
            const active = item.id === activeItemId
            return (
              <Link key={item.id} href={item.href} className={adminItemClasses(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  {'hint' in item && item.hint ? (
                    <span className="block text-[11px] leading-4 text-slate-500 group-hover:text-slate-600">{item.hint}</span>
                  ) : null}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  if (variant === 'workspaceTabs') {
    return (
      <nav className={className ?? 'flex flex-wrap items-center gap-2'}>
        {configuredItems.map((item) => {
          const Icon = resolveIcon(item)
          const active = item.id === activeItemId
          return (
            <Link key={item.id} href={item.href} className={workspaceItemClasses(active)}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className={className ?? 'flex items-center gap-2'}>
      {configuredItems.map((item) => {
        const Icon = item.icon ? resolveIcon(item) : null
        const active = item.id === activeItemId
        return (
          <Link key={item.id} href={item.href} className={topItemClasses(active)}>
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
