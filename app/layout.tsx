import type { Metadata } from 'next'
import AppShellClient from '@/components/layout/AppShellClient'
import { isUserRole, type UserRole } from '@/lib/auth/roles'
import type { EmployerPlanId } from '@/lib/billing/plan'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { supabaseServer } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: 'Internactive',
  description: 'Internships that fit your major and schedule.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=3' },
      { url: '/icon.png?v=3', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png?v=3', type: 'image/png' }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: UserRole | undefined
  let email: string | null = null
  let avatarUrl: string | null = null
  let isEmailVerified = true
  let showInboxNotificationDot = false
  let showNotificationsDot = false
  let employerPlanId: EmployerPlanId | null = null
  if (user) {
    email = user.email ?? null
    const metadata = (user.user_metadata ?? {}) as { avatar_url?: string }
    avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null
    isEmailVerified = Boolean(user.email_confirmed_at)
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (isUserRole(userRow?.role)) {
      role = userRow.role
    }

    if (role === 'employer') {
      const verification = await getEmployerVerificationStatus({ supabase, userId: user.id })
      employerPlanId = verification.planId

      const { data: internships } = await supabase
        .from('internships')
        .select('id')
        .eq('employer_id', user.id)
        .limit(200)
      const internshipIds = (internships ?? []).map((row) => row.id).filter((id): id is string => typeof id === 'string')
      if (internshipIds.length > 0) {
        const { count } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .in('internship_id', internshipIds)
          .is('employer_viewed_at', null)
        const hasUnseenApplicants = (count ?? 0) > 0
        showInboxNotificationDot = hasUnseenApplicants
        showNotificationsDot = hasUnseenApplicants
      }
    }

  }

  return (
    <html lang="en">
      <body className="antialiased">
        <AppShellClient
          isAuthenticated={Boolean(user)}
          role={role}
          email={email}
          avatarUrl={avatarUrl}
          isEmailVerified={isEmailVerified}
          showFinishProfilePrompt={false}
          finishProfileHref={null}
          showInboxNotificationDot={showInboxNotificationDot}
          showNotificationsDot={showNotificationsDot}
          employerPlanId={employerPlanId}
        >
          {children}
        </AppShellClient>
      </body>
    </html>
  )
}
