'use server'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { getAppUrl, getStripeClient } from '@/lib/billing/stripe'
import { supabaseServer } from '@/lib/supabase/server'
import { getStudentPremiumPriceId, STUDENT_PREMIUM_PLAN_KEY } from '@/lib/student/premiumPlan'

function isNextRedirectError(error: unknown): error is { digest: string } {
  if (!error || typeof error !== 'object' || !('digest' in error)) return false
  return typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')
}

function idempotencyKeyFor(action: 'customer' | 'checkout' | 'billing_portal' | 'trial', userId: string, extra = '') {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000))
  return `${action}:${userId}:${extra}:${bucket}`
}

async function getOrCreateStripeCustomerForUser(params: {
  userId: string
  email: string | null
}) {
  const { userId, email } = params
  const supabase = await supabaseServer()

  const { data: existing, error: existingError } = await supabase
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const stripe = getStripeClient()
  const customer = await stripe.customers.create(
    {
      email: email ?? undefined,
      metadata: {
        user_id: userId,
      },
    },
    {
      idempotencyKey: idempotencyKeyFor('customer', userId),
    }
  )

  const { error: upsertError } = await supabase.from('stripe_customers').upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return customer.id
}

export async function startStudentTrialAction() {
  try {
    const { user } = await requireRole('student', { requestedPath: '/student/upgrade' })
    const supabase = await supabaseServer()

    const nowIso = new Date().toISOString()
    const trialExpiresIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: existing } = await supabase
      .from('student_premium_status')
      .select('status, trial_started_at')
      .eq('user_id', user.id)
      .maybeSingle<{ status?: string | null; trial_started_at?: string | null }>()

    if (existing?.status === 'active') {
      redirect('/student/upgrade?trial=already_active')
    }
    if (existing?.trial_started_at) {
      redirect('/student/upgrade?trial=already_used')
    }

    const { error } = await supabase.from('student_premium_status').upsert(
      {
        user_id: user.id,
        status: 'trial',
        trial_started_at: nowIso,
        trial_expires_at: trialExpiresIso,
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      redirect(`/student/upgrade?error=${encodeURIComponent(error.message)}`)
    }

    redirect('/student/upgrade?trial=started')
  } catch (error) {
    if (isNextRedirectError(error)) throw error
    const message = error instanceof Error ? error.message : 'Could not start trial'
    redirect(`/student/upgrade?error=${encodeURIComponent(message)}`)
  }
}

export async function createStudentCheckoutSessionAction() {
  try {
    const { user } = await requireRole('student', { requestedPath: '/student/upgrade' })
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: getStudentPremiumPriceId(), quantity: 1 }],
        success_url: `${getAppUrl()}/student/upgrade?checkout=success`,
        cancel_url: `${getAppUrl()}/student/upgrade?checkout=canceled`,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          plan_key: STUDENT_PREMIUM_PLAN_KEY,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            plan_key: STUDENT_PREMIUM_PLAN_KEY,
          },
        },
        allow_promotion_codes: true,
      },
      {
        idempotencyKey: idempotencyKeyFor('checkout', user.id, STUDENT_PREMIUM_PLAN_KEY),
      }
    )

    if (!session.url) {
      redirect('/student/upgrade?error=Could+not+start+checkout')
    }

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) throw error
    const message = error instanceof Error ? error.message : 'Could not start checkout'
    redirect(`/student/upgrade?error=${encodeURIComponent(message)}`)
  }
}

export const startStudentCheckoutAction = createStudentCheckoutSessionAction

export async function openStudentBillingPortalAction() {
  try {
    const { user } = await requireRole('student', { requestedPath: '/student/upgrade' })
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: `${getAppUrl()}/student/upgrade`,
      },
      {
        idempotencyKey: idempotencyKeyFor('billing_portal', user.id),
      }
    )

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) throw error
    const message = error instanceof Error ? error.message : 'Could not open billing portal'
    redirect(`/student/upgrade?error=${encodeURIComponent(message)}`)
  }
}
