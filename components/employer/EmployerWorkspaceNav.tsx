'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Briefcase, FileText, ShieldCheck, Users } from 'lucide-react'
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
}

const TABS: AppNavItem[] = [
  { id: 'employer-listings', label: 'Listings', href: '/dashboard/employer', icon: Briefcase, order: 10, match: 'prefix', activeOn: ['/dashboard/employer/new'] },
  { id: 'employer-inbox', label: 'Inbox', href: '/dashboard/employer/applicants', icon: Users, order: 20, match: 'prefix' },
  { id: 'employer-messages', label: 'Messages', href: '/dashboard/employer/messages', icon: Users, order: 30, match: 'prefix' },
  { id: 'employer-analytics', label: 'Analytics', href: '/dashboard/employer/analytics', icon: BarChart3, order: 40, match: 'prefix' },
  { id: 'employer-settings', label: 'Settings', href: '/dashboard/employer/settings', icon: ShieldCheck, order: 50, match: 'prefix' },
]

function withInternshipContext(href: string, internshipId?: string) {
  if (!internshipId) return href
  const params = new URLSearchParams({ internship_id: internshipId })
  return `${href}?${params.toString()}`
}

export default function EmployerWorkspaceNav({ selectedInternshipId: incomingInternshipId, internships, includeAllOption = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const selectedInternshipId = incomingInternshipId || ''
  const [searchValue, setSearchValue] = useState('')

  const selectedTitle = useMemo(
    () => internships.find((option) => option.id === selectedInternshipId)?.title ?? '',
    [internships, selectedInternshipId]
  )

  const itemsWithContext = useMemo(
    () => TABS.map((tab) => ({ ...tab, href: withInternshipContext(tab.href, selectedInternshipId) })),
    [selectedInternshipId]
  )

  const activeTabId = matchPath(pathname ?? '/dashboard/employer', TABS)
  const activeTabHref = TABS.find((tab) => tab.id === activeTabId)?.href ?? '/dashboard/employer'

  useEffect(() => {
    setSearchValue(selectedTitle)
  }, [selectedTitle])

  function applyListingSelection(rawValue: string) {
    const value = rawValue.trim()
    if (!value) {
      router.push(activeTabHref)
      return
    }
    const matchByTitle = internships.find((option) => option.title.toLowerCase() === value.toLowerCase())
    const internshipId = matchByTitle?.id
    if (!internshipId) return
    router.push(`${activeTabHref}?internship_id=${encodeURIComponent(internshipId)}`)
  }

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <AppNav variant="workspaceTabs" role="employer" items={itemsWithContext} />

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Listing search</label>
          <input
            list="employer-listings"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onBlur={() => applyListingSelection(searchValue)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              applyListingSelection(searchValue)
            }}
            placeholder={internships.length > 0 ? 'Type listing title' : 'No listings'}
            className="min-w-[240px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500">
            <FileText className="h-4 w-4" />
          </span>
          <datalist id="employer-listings">
            {internships.map((option) => (
              <option key={option.id} value={option.title} />
            ))}
          </datalist>
          {includeAllOption ? (
            <button
              type="button"
              onClick={() => {
                setSearchValue('')
                router.push(activeTabHref)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              All listings
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
