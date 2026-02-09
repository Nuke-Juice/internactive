'use server'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth/requireRole'
import { getAppUrl, getStripeClient, getVerifiedEmployerPriceId } from '@/lib/billing/stripe'
import { supabaseServer } from '@/lib/supabase/server'

function isNextRedirectError(error: unknown): error is { digest: string } {
  if (!error || typeof error !== 'object' || !('digest' in error)) return false
  return typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')
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
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: {
      user_id: userId,
    },
  })

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

export async function startVerifiedEmployerCheckoutAction() {
  try {
    const { user } = await requireRole('employer')
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getVerifiedEmployerPriceId(), quantity: 1 }],
      success_url: `${getAppUrl()}/upgrade?checkout=success`,
      cancel_url: `${getAppUrl()}/upgrade?checkout=canceled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      redirect('/upgrade?error=Could+not+start+checkout')
    }

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not start checkout'
    redirect(`/upgrade?error=${encodeURIComponent(message)}`)
  }
}

export async function createBillingPortalSessionAction() {
  try {
    const { user } = await requireRole('employer')
    const supabase = await supabaseServer()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    const customerId = await getOrCreateStripeCustomerForUser({
      userId: user.id,
      email: authUser?.email ?? null,
    })

    const stripe = getStripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/upgrade`,
    })

    redirect(session.url)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Could not open billing portal'
    redirect(`/upgrade?error=${encodeURIComponent(message)}`)
  }
}
