'use client'

import RouteFeedbackToasts from '@/components/feedback/RouteFeedbackToasts'
import { ToastProvider } from '@/components/feedback/ToastProvider'
import SiteHeader from '@/components/layout/SiteHeader'
import type { UserRole } from '@/lib/auth/roles'

type Props = {
  children: React.ReactNode
  isAuthenticated: boolean
  role?: UserRole
  email?: string | null
  isEmailVerified?: boolean
}

export default function AppShellClient({ children, isAuthenticated, role, email, isEmailVerified }: Props) {
  return (
    <ToastProvider>
      <RouteFeedbackToasts />
      <SiteHeader isAuthenticated={isAuthenticated} role={role} email={email} isEmailVerified={isEmailVerified} />
      {children}
    </ToastProvider>
  )
}
