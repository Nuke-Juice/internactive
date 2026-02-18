import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { getStudentEntitlements, maybeExpireTrial } from '@/lib/student/entitlements'
import {
  createStudentCheckoutSessionAction,
  openStudentBillingPortalAction,
  startStudentTrialAction,
} from '@/lib/student/premiumActions'
import { STUDENT_PREMIUM_MONTHLY_PRICE_CENTS } from '@/lib/student/premiumPlan'
import { supabaseServer } from '@/lib/supabase/server'

function priceLabel() {
  return `$${(STUDENT_PREMIUM_MONTHLY_PRICE_CENTS / 100).toFixed(2)} / month`
}

export default async function StudentUpgradePage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string; trial?: string; error?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const { user } = await requireRole('student', { requestedPath: '/student/upgrade' })
  const supabase = await supabaseServer()

  await maybeExpireTrial(user.id, { supabase })
  const entitlements = await getStudentEntitlements(user.id, { supabase })

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <Link
            href="/student/dashboard"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Upgrade</h1>
            <p className="mt-2 text-slate-600">Premium adds deeper performance insights. Core student access always stays free.</p>
          </div>
        </div>

        {resolvedSearchParams?.trial === 'started' ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Trial started. Premium insights are now unlocked for 7 days.
          </div>
        ) : null}
        {resolvedSearchParams?.trial === 'already_used' ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Trial already used. You can still upgrade any time.
          </div>
        ) : null}
        {resolvedSearchParams?.checkout === 'success' ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Upgrade successful. Premium status will refresh shortly.
          </div>
        ) : null}
        {resolvedSearchParams?.checkout === 'canceled' ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Checkout canceled.</div>
        ) : null}
        {resolvedSearchParams?.error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(resolvedSearchParams.error)}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-4xl font-semibold text-slate-900">{priceLabel()}</p>
            <p className="mt-2 text-sm text-slate-600">7-day free trial • No credit card required</p>

            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                'Resume score, metrics, and actionable suggestions',
                'Application interview/view rate insights and trend context',
                'Course strategy recommendations with estimated impact',
                'Match near-miss diagnostics and optimization guidance',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {entitlements.status === 'active' ? (
                <>
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
                  >
                    Premium active
                  </button>
                  <form action={openStudentBillingPortalAction}>
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open billing portal
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <form action={startStudentTrialAction}>
                    <button
                      type="submit"
                      disabled={entitlements.status === 'trial'}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {entitlements.status === 'trial' ? 'Trial active' : 'Start free trial'}
                    </button>
                  </form>
                  <form action={createStudentCheckoutSessionAction}>
                    <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      Upgrade now
                    </button>
                  </form>
                </>
              )}
            </div>
          </article>

          <article className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Status</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                Plan: <span className="font-semibold text-slate-900">{entitlements.status}</span>
              </p>
              {entitlements.status === 'trial' ? (
                <p>Trial ends in {entitlements.trialDaysRemaining} day(s). You won&apos;t be charged automatically.</p>
              ) : null}
              {entitlements.status === 'active' ? <p>Premium active.</p> : null}
              {entitlements.status === 'expired' ? <p>Trial expired — upgrade to keep insights.</p> : null}
              {entitlements.status === 'free' ? <p>Start trial or upgrade when you want deeper insights.</p> : null}
              <p className="text-xs text-slate-600">Browsing listings, match score visibility, applying, and application tracking always stay available.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
