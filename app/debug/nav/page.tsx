import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import NavDebugDetails from '@/components/debug/NavDebugDetails'
import { isAdminRole, isUserRole } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'

type Props = {
  searchParams?: Promise<{
    pathname?: string
  }>
}

export default async function NavDebugPage({ searchParams }: Props) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const params = (await searchParams) ?? {}

  const { data: userRow } = user
    ? await supabase.from('users').select('role').eq('id', user.id).maybeSingle<{ role?: string | null }>()
    : { data: null }

  const resolvedRole = isUserRole(userRow?.role) ? userRow.role : null
  const allowAccess = process.env.NODE_ENV !== 'production' || isAdminRole(resolvedRole)

  if (!allowAccess) {
    notFound()
  }

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'unknown'
  const pathname = typeof params.pathname === 'string' && params.pathname.startsWith('/') ? params.pathname : '/debug/nav'

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Navigation debug</h1>
          <p className="mt-2 text-sm text-slate-600">
            Confirms the resolved role and active navigation config for the current route.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-500">resolved role</dt>
              <dd className="text-slate-900">{resolvedRole ?? 'anonymous'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">host</dt>
              <dd className="text-slate-900">{host}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">pathname</dt>
              <dd className="text-slate-900">{pathname}</dd>
            </div>
          </dl>
        </section>
        <NavDebugDetails role={resolvedRole} pathname={pathname} />
      </div>
    </main>
  )
}
