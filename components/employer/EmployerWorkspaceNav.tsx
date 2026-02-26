'use client'

import { type ReactNode, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Briefcase, Cog, MessageSquare, Users } from 'lucide-react'
import AppNav, { type AppNavItem } from '@/components/navigation/AppNav'
import { matchPath } from '@/src/navigation/matchPath'

type InternshipOption = {
  id: string
  title: string
}

type Props = {
  activeTab?: 'listings' | 'applicants' | 'messages' | 'analytics' | 'settings'
  selectedInternshipId?: string
  internships: InternshipOption[]
  includeAllOption?: boolean
  rightSlot?: ReactNode
}

const TABS: AppNavItem[] = [
  { id: 'employer-listings', label: 'Listings', href: '/dashboard/employer', icon: Briefcase, order: 10, match: 'prefix', activeOn: ['/dashboard/employer/new'] },
  { id: 'employer-inbox', label: 'Inbox', href: '/dashboard/employer/applicants', icon: Users, order: 20, match: 'prefix' },
  { id: 'employer-messages', label: 'Messages', href: '/dashboard/employer/messages', icon: MessageSquare, order: 30, match: 'prefix' },
  { id: 'employer-analytics', label: 'Analytics', href: '/dashboard/employer/analytics', icon: BarChart3, order: 40, match: 'prefix' },
  { id: 'employer-settings', label: 'Settings', href: '/dashboard/employer/settings', icon: Cog, order: 50, match: 'prefix' },
]

function withInternshipContext(href: string, internshipId?: string) {
  if (!internshipId) return href
  const params = new URLSearchParams({ internship_id: internshipId })
  return `${href}?${params.toString()}`
}

export default function EmployerWorkspaceNav({
  selectedInternshipId: incomingInternshipId,
  internships,
  includeAllOption = false,
  rightSlot = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const selectedInternshipId = incomingInternshipId || ''

  const itemsWithContext = useMemo(
    () =>
      TABS.map((tab) => {
        if (tab.id === 'employer-inbox') {
          // Main inbox should default to all listings unless the user explicitly scopes via listing search.
          return { ...tab, href: tab.href }
        }
        return { ...tab, href: withInternshipContext(tab.href, selectedInternshipId) }
      }),
    [selectedInternshipId]
  )

  const activeTabId = matchPath(pathname ?? '/dashboard/employer', TABS)
  const activeTabHref = TABS.find((tab) => tab.id === activeTabId)?.href ?? '/dashboard/employer'

  function applyListingSelection(internshipId: string) {
    const nextId = internshipId.trim()
    if (!nextId) {
      router.push(activeTabHref)
      return
    }
    router.push(`${activeTabHref}?internship_id=${encodeURIComponent(nextId)}`)
  }

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 md:flex-1">
          <AppNav variant="workspaceTabs" role="employer" items={itemsWithContext} className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5 pr-1" />
        </div>

        {rightSlot ? (
          <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
        ) : (
          <div className="flex shrink-0 items-center justify-end gap-2">
            <label htmlFor="employer-workspace-listing" className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
              Listing
            </label>
            <select
              id="employer-workspace-listing"
              value={selectedInternshipId}
              onChange={(event) => applyListingSelection(event.target.value)}
              className="h-12 w-[280px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            >
              {includeAllOption ? <option value="">All listings</option> : null}
              {internships.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
