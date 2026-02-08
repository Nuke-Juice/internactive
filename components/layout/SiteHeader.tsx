'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type UserRole = 'student' | 'employer'

type SiteHeaderProps = {
  isAuthenticated: boolean
  role?: UserRole
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
    </svg>
  )
}

function JobsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M3 13h18" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function ApplicationsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function EmployerDashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M5 21V7h14v14" />
      <path d="M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  )
}

function EmployerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20h16" />
      <path d="M6 20V8h12v12" />
      <path d="M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H4" />
      <path d="M20 4v16" />
    </svg>
  )
}

function navClasses(isActive: boolean) {
  if (isActive) {
    return 'rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700'
  }

  return 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
}

export default function SiteHeader({ isAuthenticated, role }: SiteHeaderProps) {
  const pathname = usePathname()
  const homeActive = pathname === '/'
  const jobsActive = pathname.startsWith('/jobs')
  const accountActive = pathname === '/account'
  const applicationsActive = pathname.startsWith('/applications')
  const employerDashboardActive = pathname.startsWith('/dashboard/employer')
  const employerActive = pathname.startsWith('/signup/employer')
  const loginActive = pathname.startsWith('/login')

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-blue-600" aria-hidden />
          <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
            Internactive
          </Link>
          <Link href="/" className={navClasses(homeActive)}>
            <span className="inline-flex items-center gap-1.5">
              <HomeIcon />
              Home
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <Link href="/jobs" className={navClasses(jobsActive)}>
            <span className="inline-flex items-center gap-1.5">
              <JobsIcon />
              Jobs
            </span>
          </Link>
          <Link href="/account" className={navClasses(accountActive)}>
            <span className="inline-flex items-center gap-1.5">
              <AccountIcon />
              Account
            </span>
          </Link>

          {isAuthenticated && role === 'student' ? (
            <Link href="/applications" className={navClasses(applicationsActive)}>
              <span className="inline-flex items-center gap-1.5">
                <ApplicationsIcon />
                Applications
              </span>
            </Link>
          ) : null}

          {isAuthenticated && role === 'employer' ? (
            <Link href="/dashboard/employer" className={navClasses(employerDashboardActive)}>
              <span className="inline-flex items-center gap-1.5">
                <EmployerDashboardIcon />
                Employer dashboard
              </span>
            </Link>
          ) : null}

          <Link href="/signup/employer" className={navClasses(employerActive)}>
            <span className="inline-flex items-center gap-1.5">
              <EmployerIcon />
              Employer
            </span>
          </Link>

          {!isAuthenticated ? (
            <Link href="/login" className={navClasses(loginActive)}>
              <span className="inline-flex items-center gap-1.5">
                <LoginIcon />
                Log in
              </span>
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  )
}
