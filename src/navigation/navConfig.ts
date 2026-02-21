export type NavRole = 'student' | 'employer' | 'admin' | 'public'
export type NavGroup = 'primary' | 'secondary'
export type NavContext = 'top' | 'workspace' | 'admin'
export type NavMatchMode = 'exact' | 'prefix'

export type NavItem = {
  id: string
  label: string
  href: string
  roles: NavRole[]
  group: NavGroup
  contexts: NavContext[]
  order: number
  match: NavMatchMode
  activeOn?: string[]
  icon?:
    | 'dashboard'
    | 'applications'
    | 'listings'
    | 'inbox'
    | 'analytics'
    | 'settings'
    | 'queue'
    | 'employers'
    | 'students'
    | 'home'
    | 'upgrade'
  hint?: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    roles: ['public', 'student', 'employer', 'admin'],
    group: 'secondary',
    contexts: ['top'],
    order: 10,
    match: 'exact',
    activeOn: ['/jobs'],
    icon: 'home',
  },
  {
    id: 'for-employers',
    label: 'For Employers',
    href: '/for-employers',
    roles: ['public', 'student'],
    group: 'secondary',
    contexts: ['top'],
    order: 15,
    match: 'prefix',
    activeOn: ['/signup/employer'],
  },
  {
    id: 'admin-dashboard',
    label: 'Dashboard',
    href: '/admin',
    roles: ['admin'],
    group: 'primary',
    contexts: ['top', 'admin'],
    order: 20,
    match: 'exact',
    icon: 'dashboard',
    hint: 'Admin home',
  },
  {
    id: 'student-dashboard',
    label: 'Dashboard',
    href: '/student/dashboard',
    roles: ['student'],
    group: 'primary',
    contexts: ['top', 'workspace'],
    order: 20,
    match: 'prefix',
    activeOn: ['/dashboard/student'],
    icon: 'dashboard',
  },
  {
    id: 'employer-dashboard',
    label: 'Dashboard',
    href: '/dashboard/employer',
    roles: ['employer'],
    group: 'primary',
    contexts: ['top'],
    order: 20,
    match: 'prefix',
    icon: 'dashboard',
  },
  {
    id: 'employer-listings',
    label: 'Listings',
    href: '/dashboard/employer',
    roles: ['employer'],
    group: 'primary',
    contexts: ['workspace'],
    order: 10,
    match: 'prefix',
    activeOn: ['/dashboard/employer/new'],
    icon: 'listings',
  },
  {
    id: 'employer-inbox',
    label: 'Inbox',
    href: '/dashboard/employer/applicants',
    roles: ['employer'],
    group: 'primary',
    contexts: ['workspace'],
    order: 20,
    match: 'prefix',
    icon: 'inbox',
  },
  {
    id: 'employer-messages',
    label: 'Messages',
    href: '/dashboard/employer/messages',
    roles: ['employer'],
    group: 'secondary',
    contexts: ['workspace'],
    order: 30,
    match: 'prefix',
    icon: 'inbox',
  },
  {
    id: 'employer-analytics',
    label: 'Analytics',
    href: '/dashboard/employer/analytics',
    roles: ['employer'],
    group: 'primary',
    contexts: ['workspace'],
    order: 40,
    match: 'prefix',
    icon: 'analytics',
  },
  {
    id: 'employer-settings',
    label: 'Settings',
    href: '/dashboard/employer/settings',
    roles: ['employer'],
    group: 'secondary',
    contexts: ['workspace'],
    order: 50,
    match: 'prefix',
    icon: 'settings',
  },
  {
    id: 'student-applications',
    label: 'Applications',
    href: '/applications',
    roles: ['student'],
    group: 'primary',
    contexts: ['workspace'],
    order: 30,
    match: 'prefix',
    icon: 'applications',
  },
  {
    id: 'student-inbox',
    label: 'Inbox',
    href: '/inbox',
    roles: ['student'],
    group: 'primary',
    contexts: ['workspace'],
    order: 40,
    match: 'prefix',
    icon: 'inbox',
  },
  {
    id: 'admin-queue',
    label: 'Queue',
    href: '/admin/listings-queue',
    roles: ['admin'],
    group: 'primary',
    contexts: ['admin'],
    order: 30,
    match: 'prefix',
    icon: 'queue',
    hint: 'Moderate listings',
  },
  {
    id: 'admin-listings',
    label: 'Listings',
    href: '/admin/internships',
    roles: ['admin'],
    group: 'primary',
    contexts: ['admin'],
    order: 40,
    match: 'prefix',
    icon: 'listings',
    hint: 'All listings',
  },
  {
    id: 'admin-employers',
    label: 'Employers',
    href: '/admin/employers',
    roles: ['admin'],
    group: 'primary',
    contexts: ['admin'],
    order: 50,
    match: 'prefix',
    icon: 'employers',
    hint: 'Claim + contacts',
  },
  {
    id: 'admin-students',
    label: 'Students',
    href: '/admin/students',
    roles: ['admin'],
    group: 'primary',
    contexts: ['admin'],
    order: 60,
    match: 'prefix',
    icon: 'students',
    hint: 'Profiles + coverage',
  },
  {
    id: 'admin-analytics',
    label: 'Analytics',
    href: '/admin/matching/preview',
    roles: ['admin'],
    group: 'primary',
    contexts: ['admin'],
    order: 70,
    match: 'prefix',
    activeOn: ['/admin/matching/report'],
    icon: 'analytics',
    hint: 'Preview + report',
  },
  {
    id: 'employer-upgrade',
    label: 'Upgrade',
    href: '/upgrade',
    roles: ['employer'],
    group: 'secondary',
    contexts: ['top'],
    order: 80,
    match: 'prefix',
    icon: 'upgrade',
  },
  {
    id: 'student-upgrade',
    label: 'Upgrade',
    href: '/student/upgrade',
    roles: ['student'],
    group: 'secondary',
    contexts: ['top'],
    order: 80,
    match: 'prefix',
    icon: 'upgrade',
  },
]
