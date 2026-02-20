'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type TabKey = 'listings' | 'applicants' | 'messages' | 'analytics'

type InternshipOption = {
  id: string
  title: string
}

type Props = {
  activeTab: TabKey
  selectedInternshipId?: string
  internships: InternshipOption[]
  includeAllOption?: boolean
}

const TABS: Array<{ key: TabKey; label: string; href: string }> = [
  { key: 'listings', label: 'Listings', href: '/dashboard/employer' },
  { key: 'applicants', label: 'Applicants', href: '/dashboard/employer/applicants' },
  { key: 'analytics', label: 'Analytics', href: '/dashboard/employer/analytics' },
]

function tabClass(active: boolean) {
  return `inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium ${
    active ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`
}

function withInternshipContext(href: string, internshipId?: string) {
  if (!internshipId) return href
  const params = new URLSearchParams({ internship_id: internshipId })
  return `${href}?${params.toString()}`
}

export default function EmployerWorkspaceNav(props: Props) {
  const router = useRouter()
  const selectedInternshipId = props.selectedInternshipId || ''
  const [searchValue, setSearchValue] = useState('')

  const activeTabHref = TABS.find((item) => item.key === props.activeTab)?.href ?? '/dashboard/employer'
  const selectedTitle = useMemo(
    () => props.internships.find((option) => option.id === selectedInternshipId)?.title ?? '',
    [props.internships, selectedInternshipId]
  )

  useEffect(() => {
    setSearchValue(selectedTitle)
  }, [selectedTitle])

  function applyListingSelection(rawValue: string) {
    const value = rawValue.trim()
    if (!value) {
      router.push(activeTabHref)
      return
    }
    const matchByTitle = props.internships.find((option) => option.title.toLowerCase() === value.toLowerCase())
    const internshipId = matchByTitle?.id
    if (!internshipId) return
    router.push(`${activeTabHref}?internship_id=${encodeURIComponent(internshipId)}`)
  }

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <Link key={tab.key} href={withInternshipContext(tab.href, selectedInternshipId)} className={tabClass(tab.key === props.activeTab)}>
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Listing search</label>
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
            placeholder={props.internships.length > 0 ? 'Type listing title' : 'No listings'}
            className="min-w-[240px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          />
          <datalist id="employer-listings">
            {props.internships.map((option) => (
              <option key={option.id} value={option.title} />
            ))}
          </datalist>
          {props.includeAllOption ? (
            <button
              type="button"
              onClick={() => {
                setSearchValue('')
                router.push(activeTabHref)
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              All listings
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
