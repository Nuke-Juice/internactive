import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

function roleLabel(role: string | null) {
  if (role === 'employer') {
    return {
      title: 'Inbox',
      subtitle: 'Messages with candidates and hiring conversations will appear here.',
    }
  }
  if (role === 'student') {
    return {
      title: 'Inbox',
      subtitle: 'Messages with employers and recruiting threads will appear here.',
    }
  }

  return {
    title: 'Inbox',
    subtitle: 'Sign in to view your messages and conversation threads.',
  }
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = typeof userRow?.role === 'string' ? userRow.role : null
  }

  if (role === 'employer') {
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const forward = new URLSearchParams()
    if (resolvedSearchParams) {
      for (const [key, value] of Object.entries(resolvedSearchParams)) {
        if (typeof value === 'string' && value.trim()) {
          forward.set(key, value)
        }
      }
    }
    const suffix = forward.toString()
    redirect(`/dashboard/employer/applicants${suffix ? `?${suffix}` : ''}`)
  }

  const content = roleLabel(role)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold text-slate-900">{content.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{content.subtitle}</p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">No messages yet.</h2>
          <p className="mt-1 text-sm text-slate-600">Start a conversation once messaging is enabled.</p>
        </div>
      </section>
    </main>
  )
}
