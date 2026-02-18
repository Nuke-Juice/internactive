import Stripe from 'stripe'
import { getStripeClient, getStripeWebhookSecretForMode } from '@/lib/billing/stripe'
import { isVerifiedEmployerStatus, resolveEmployerPlan } from '@/lib/billing/subscriptions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { STUDENT_PREMIUM_PLAN_KEY } from '@/lib/student/premiumPlan'

export const runtime = 'nodejs'

type ClaimResult = 'claimed' | 'duplicate'

export type StripeWebhookIdempotencyDeps = {
  claimEvent: (event: Stripe.Event) => Promise<ClaimResult>
  markDone: (event: Stripe.Event) => Promise<void>
  markFailed: (event: Stripe.Event) => Promise<void>
}

type StripeWebhookProcessorDeps = StripeWebhookIdempotencyDeps & {
  handleCheckoutSessionCompleted: (event: Stripe.Event) => Promise<void>
  handleSubscriptionUpdatedOrDeleted: (event: Stripe.Event) => Promise<void>
}

async function claimEvent(event: Stripe.Event): Promise<ClaimResult> {
  const supabase = supabaseAdmin()
  const { error } = await supabase.from('processed_stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    status: 'processing',
  })

  if (!error) return 'claimed'
  if (error.code === '23505') return 'duplicate'
  throw new Error(error.message)
}

async function markEventStatus(event: Stripe.Event, status: 'done' | 'failed') {
  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('processed_stripe_events')
    .update({ status, event_type: event.type })
    .eq('event_id', event.id)

  if (error) {
    throw new Error(error.message)
  }
}

async function markDone(event: Stripe.Event) {
  await markEventStatus(event, 'done')
}

async function markFailed(event: Stripe.Event) {
  await markEventStatus(event, 'failed')
}

function unixSecondsToIso(value: number | null | undefined) {
  if (!value) return null
  return new Date(value * 1000).toISOString()
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.current_period_end ?? null
}

function resolveStudentPremiumStatus(status: string, currentPeriodEndIso: string | null) {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'active' || normalized === 'trialing') return 'active'
  if (normalized === 'canceled') {
    if (currentPeriodEndIso && new Date(currentPeriodEndIso).getTime() > Date.now()) return 'canceled'
    return 'expired'
  }
  if (normalized === 'past_due' || normalized === 'unpaid' || normalized === 'incomplete') return 'canceled'
  return 'expired'
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
  const paidVerifiedTier = isVerifiedEmployerStatus(status) && plan.id === 'pro'
  const { data: employerProfile } = await supabase
    .from('employer_profiles')
    .select('verified_employer_manual_override')
    .eq('user_id', userId)
    .maybeSingle()
  const hasManualOverride = Boolean(
    (employerProfile as { verified_employer_manual_override?: boolean | null } | null)
      ?.verified_employer_manual_override
  )
  const verifiedEmployer = paidVerifiedTier || hasManualOverride
  const employerVerificationTier = verifiedEmployer ? 'pro' : 'free'

  await supabase
    .from('employer_profiles')
    .update({
      email_alerts_enabled: isVerifiedEmployerStatus(status) && plan.emailAlertsEnabled,
      verified_employer: verifiedEmployer,
    })
    .eq('user_id', userId)

  await supabase
    .from('internships')
    .update({ employer_verification_tier: employerVerificationTier })
    .eq('employer_id', userId)
}

async function upsertStudentPremiumStatus(params: {
  userId: string
  stripeSubscriptionId: string
  stripeCustomerId: string | null
  status: string
  currentPeriodEnd: string | null
}) {
  const supabase = supabaseAdmin()
  const { userId, stripeSubscriptionId, stripeCustomerId, status, currentPeriodEnd } = params

  const nextStatus = resolveStudentPremiumStatus(status, currentPeriodEnd)
  const activeSince = nextStatus === 'active' ? new Date().toISOString() : null

  const { error } = await supabase.from('student_premium_status').upsert(
    {
      user_id: userId,
      status: nextStatus,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      active_since: activeSince,
      current_period_end: currentPeriodEnd,
      trial_started_at: null,
      trial_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    throw new Error(error.message)
  }
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
  const currentPeriodEnd = unixSecondsToIso(getSubscriptionCurrentPeriodEnd(subscription))
  const planKey = subscription.metadata?.plan_key ?? session.metadata?.plan_key ?? null

  if (planKey === STUDENT_PREMIUM_PLAN_KEY) {
    await upsertStudentPremiumStatus({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: stripeCustomerIdFromSubscription ?? null,
      status: subscription.status,
      currentPeriodEnd,
    })
    return
  }

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? null,
    currentPeriodEnd,
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

  const currentPeriodEnd = unixSecondsToIso(getSubscriptionCurrentPeriodEnd(subscription))
  const planKey = subscription.metadata?.plan_key ?? null

  if (planKey === STUDENT_PREMIUM_PLAN_KEY) {
    await upsertStudentPremiumStatus({
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId,
      status: subscription.status,
      currentPeriodEnd,
    })
    return
  }

  await upsertSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? null,
    currentPeriodEnd,
  })
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  deps: StripeWebhookProcessorDeps = {
    claimEvent,
    markDone,
    markFailed,
    handleCheckoutSessionCompleted,
    handleSubscriptionUpdatedOrDeleted,
  }
) {
  const claimResult = await deps.claimEvent(event)
  if (claimResult === 'duplicate') {
    return { duplicate: true as const }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await deps.handleCheckoutSessionCompleted(event)
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await deps.handleSubscriptionUpdatedOrDeleted(event)
    }

    await deps.markDone(event)
    return { duplicate: false as const }
  } catch (error) {
    try {
      await deps.markFailed(event)
    } catch {
      // Preserve original processing error when failure status cannot be written.
    }
    throw error
  }
}

export async function POST(request: Request) {
  let webhookSecret = ''
  try {
    webhookSecret = getStripeWebhookSecretForMode()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Missing webhook secret'
    return new Response(message, { status: 500 })
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
    const result = await processStripeWebhookEvent(event)
    if (result.duplicate) {
      return Response.json({ received: true, duplicate: true })
    }

    return Response.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler failed'
    return new Response(message, { status: 500 })
  }
}
