import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { type UserRole } from '@/lib/auth/roles'

export async function requireRole<T extends UserRole>(role: T) {
  const supabase = await supabaseServer()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/login')

  const { data: userRow, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (roleError || !userRow || userRow.role !== role) redirect('/')

  return { user: data.user, role: userRow.role as T }
}
