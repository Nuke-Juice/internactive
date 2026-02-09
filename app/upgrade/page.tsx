import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createBillingPortalSessionAction, startVerifiedEmployerCheckoutAction } from '@/lib/billing/actions'
import { getEmployerVerificationStatus } from '@/lib/billing/subscriptions'
import { supabaseServer } from '@/lib/supabase/server'

function formatDate(value: string | null) {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string; error?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Verified Employer</h1>
            <p className="mt-2 text-slate-600">Upgrade your employer account to post unlimited internships and receive email alerts.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/login" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Log in
              </Link>
              <Link
                href="/signup/employer"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Create employer account
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (userRow?.role !== 'employer') {
    return (
      <main className="min-h-screen bg-slate-50">
        <section className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Verified Employer</h1>
            <p className="mt-2 text-slate-600">Billing is available for employer accounts only.</p>
            <Link
              href="/account"
              className="mt-6 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open account
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const [{ isVerifiedEmployer, status }, { data: subscription }] = await Promise.all([
    getEmployerVerificationStatus({ supabase, userId: user.id }),
    supabase
      .from('subscriptions')
      .select('price_id, current_period_end, updated_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Verified Employer</h1>
          <p className="mt-2 text-slate-600">$49/month. Unlimited active internships + employer email alerts.</p>

          {resolvedSearchParams?.checkout === 'success' && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Checkout completed. Your subscription status will update shortly.
            </div>
          )}
          {resolvedSearchParams?.checkout === 'canceled' && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Checkout canceled.
            </div>
          )}
          {resolvedSearchParams?.error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(resolvedSearchParams.error)}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Current plan</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {isVerifiedEmployer ? 'Verified Employer' : 'Free Employer'}
              </div>
              <div className="mt-1 text-xs text-slate-500">Status: {status ?? 'none'}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">Current period end</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{formatDate(subscription?.current_period_end ?? null)}</div>
              <div className="mt-1 text-xs text-slate-500">Price ID: {subscription?.price_id ?? 'n/a'}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <form action={startVerifiedEmployerCheckoutAction}>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Upgrade for $49/mo
              </button>
            </form>
            <form action={createBillingPortalSessionAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Manage subscription
              </button>
            </form>
            <Link
              href="/dashboard/employer"
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
