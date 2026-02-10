import Stripe from 'stripe'
import { getStripeClient } from '@/lib/billing/stripe'
import { isVerifiedEmployerStatus, resolveEmployerPlan } from '@/lib/billing/subscriptions'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function unixSecondsToIso(value: number | null | undefined) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.current_period_end ?? null
}

async function resolveUserIdForCustomer(stripeCustomerId: string) {
  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle()

  const row = data as { user_id: string } | null
  return row?.user_id ?? null
}

async function upsertSubscription(params: {
  userId: string
  stripeSubscriptionId: string
  status: string
  priceId: string | null
  currentPeriodEnd: string | null
}) {
  const supabase = supabaseAdmin()

  const { userId, stripeSubscriptionId, status, priceId, currentPeriodEnd } = params
  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: stripeSubscriptionId,
      status,
      price_id: priceId,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    throw new Error(error.message)
  }

  const plan = resolveEmployerPlan({ status, priceId })
  const employerVerificationTier = isVerifiedEmployerStatus(status) ? plan.id : 'free'
  await supabase
    .from('employer_profiles')
    .update({ email_alerts_enabled: isVerifiedEmployerStatus(status) && plan.emailAlertsEnabled })
    .eq('user_id', userId)

  await supabase
    .from('internships')
    .update({ employer_verification_tier: employerVerificationTier })
    .eq('employer_id', userId)
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session
  if (session.mode !== 'subscription') {
    return
  }

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
  const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null
  const userIdFromMetadata = session.metadata?.user_id ?? session.client_reference_id ?? null

  const supabase = supabaseAdmin()

  if (userIdFromMetadata && stripeCustomerId) {
    await supabase.from('stripe_customers').upsert(
      {
        user_id: userIdFromMetadata,
        stripe_customer_id: stripeCustomerId,
      },
      { onConflict: 'user_id' }
    )
  }

  if (!stripeSubscriptionId) {
    return
  }

  const stripe = getStripeClient()
  const subscription = (await stripe.subscriptions.retrieve(stripeSubscriptionId)) as unknown as Stripe.Subscription
  const stripeCustomerIdFromSubscription =
    typeof subscription.customer === 'string' ? subscription.customer : stripeCustomerId

  const userId =
    userIdFromMetadata ||
    (stripeCustomerIdFromSubscription ? await resolveUserIdForCustomer(stripeCustomerIdFromSubscription) : null)

  if (!userId) {
    return
  }

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? null,
    currentPeriodEnd: unixSecondsToIso(getSubscriptionCurrentPeriodEnd(subscription)),
  })
}

async function handleSubscriptionUpdatedOrDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null
  if (!stripeCustomerId) {
    return
  }

  const userId = await resolveUserIdForCustomer(stripeCustomerId)
  if (!userId) {
    return
  }

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? null,
    currentPeriodEnd: unixSecondsToIso(getSubscriptionCurrentPeriodEnd(subscription)),
  })
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return new Response('Missing STRIPE_WEBHOOK_SECRET', { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  const payload = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch {
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(event)
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await handleSubscriptionUpdatedOrDeleted(event)
    }

    return Response.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed'
    return new Response(message, { status: 500 })
  }
}
