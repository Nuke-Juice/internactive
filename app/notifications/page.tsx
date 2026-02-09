import { supabaseServer } from '@/lib/supabase/server'

function roleLabel(role: string | null) {
  if (role === 'employer') {
    return {
      title: 'Notifications',
      subtitle: 'We will show employer updates here, like new applicants and billing events.',
    }
  }

  return {
    title: 'Notifications',
    subtitle: 'We will show student updates here, like application status and interview activity.',
  }
}

export default async function NotificationsPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = typeof userRow?.role === 'string' ? userRow.role : null
  }

  const content = roleLabel(role)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-slate-900">{content.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{content.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">No notifications yet.</h2>
          <p className="mt-1 text-sm text-slate-600">You are all caught up.</p>
        </div>
      </section>
    </main>
  )
}
