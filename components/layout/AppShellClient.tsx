'use client'

import { usePathname } from 'next/navigation'
import CookieNoticeBanner from '@/components/CookieNoticeBanner'
import GlobalErrorToasts from '@/components/feedback/GlobalErrorToasts'
import RouteFeedbackToasts from '@/components/feedback/RouteFeedbackToasts'
import { ToastProvider } from '@/components/feedback/ToastProvider'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'
import type { UserRole } from '@/lib/auth/roles'
import type { EmployerPlanId } from '@/lib/billing/plan'

type Props = {
  children: React.ReactNode
  isAuthenticated: boolean
  role?: UserRole
  email?: string | null
  avatarUrl?: string | null
  isEmailVerified?: boolean
  showFinishProfilePrompt?: boolean
  finishProfileHref?: string | null
  showNotificationsDot?: boolean
  employerPlanId?: EmployerPlanId | null
}

export default function AppShellClient({
  children,
  isAuthenticated,
  role,
  email,
  avatarUrl,
  isEmailVerified,
  showFinishProfilePrompt = false,
  finishProfileHref = null,
  showNotificationsDot = false,
  employerPlanId = null,
}: Props) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin') ?? false

  return (
    <ToastProvider>
      <GlobalErrorToasts />
      <RouteFeedbackToasts />
      {isAdminRoute ? null : (
        <SiteHeader
          isAuthenticated={isAuthenticated}
          role={role}
          email={email}
          avatarUrl={avatarUrl}
          isEmailVerified={isEmailVerified}
          showFinishProfilePrompt={showFinishProfilePrompt}
          finishProfileHref={finishProfileHref}
          showNotificationsDot={showNotificationsDot}
          employerPlanId={employerPlanId}
        />
      )}
      {children}
      <SiteFooter />
      <CookieNoticeBanner />
    </ToastProvider>
  )
}
