import type { Metadata } from 'next'
import AppShellClient from '@/components/layout/AppShellClient'
import { isUserRole, type UserRole } from '@/lib/auth/roles'
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
  let isEmailVerified = true
  if (user) {
    email = user.email ?? null
    isEmailVerified = Boolean(user.email_confirmed_at)
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    if (isUserRole(userRow?.role)) {
      role = userRow.role
    }
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <AppShellClient
          isAuthenticated={Boolean(user)}
          role={role}
          email={email}
          isEmailVerified={isEmailVerified}
        >
          {children}
        </AppShellClient>
      </body>
    </html>
  )
}
