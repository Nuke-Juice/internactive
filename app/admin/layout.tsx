import type { ReactNode } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import AdminSectionNav from '@/components/admin/AdminSectionNav'
import { supabaseServer } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const metadata = (user?.user_metadata ?? {}) as { avatar_url?: string }
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null

  return (
    <>
      <AdminHeader email={user?.email ?? null} avatarUrl={avatarUrl} />
      <AdminSectionNav />
      {children}
    </>
  )
}
