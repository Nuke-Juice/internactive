'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Briefcase, FileText, Mail, Users } from 'lucide-react'
import type { ComponentType } from 'react'

type NavItem = {
  label: string
  hint: string
  href: string
  icon: ComponentType<{ className?: string }>
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Queue',
    hint: 'Moderate listings',
    href: '/admin/listings-queue',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/admin/listings-queue'),
  },
  {
    label: 'Internships',
    hint: 'All listings',
    href: '/admin/internships',
    icon: Briefcase,
    match: (pathname) => pathname.startsWith('/admin/internships'),
  },
  {
    label: 'Employers',
    hint: 'Claim + contacts',
    href: '/admin/employers',
    icon: Mail,
    match: (pathname) => pathname.startsWith('/admin/employers'),
  },
  {
    label: 'Students',
    hint: 'Profiles + coverage',
    href: '/admin/students',
    icon: Users,
    match: (pathname) => pathname.startsWith('/admin/students'),
  },
  {
    label: 'Matching',
    hint: 'Preview + report',
    href: '/admin/matching/preview',
    icon: BarChart3,
    match: (pathname) => pathname.startsWith('/admin/matching'),
  },
]

function cardClass(active: boolean) {
  return `group inline-flex min-w-[150px] items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
    active
      ? 'border-blue-300 bg-blue-50 text-blue-800'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  }`
}

export default function AdminSectionNav() {
  const pathname = usePathname()
  const router = useRouter()

  const activeHref = NAV_ITEMS.find((item) => item.match(pathname))?.href ?? '/admin'

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-3">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin"
              className={`inline-flex h-10 items-center rounded-lg border px-3 text-sm font-semibold ${
                pathname === '/admin'
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Overview
            </Link>
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
                {NAV_ITEMS.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Link
            href="/admin/internships/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <span className="text-base leading-none">+</span>
            New internship
          </Link>
        </div>

        <div className="mt-2 hidden gap-2 overflow-x-auto pb-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={cardClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-[11px] leading-4 text-slate-500 group-hover:text-slate-600">{item.hint}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
