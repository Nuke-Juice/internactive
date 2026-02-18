import assert from 'node:assert/strict'
import test from 'node:test'
import type Stripe from 'stripe'
import { processStripeWebhookEvent } from '../app/api/stripe/webhook/route.ts'

function buildEvent(id: string, type: Stripe.Event.Type): Stripe.Event {
  return {
    id,
    object: 'event',
    api_version: '2024-10-28.acacia',
    created: Math.floor(Date.now() / 1000),
    data: { object: {} as Stripe.Event.Data.Object },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type,
  } as Stripe.Event
}

test('concurrent duplicate deliveries execute side effects once', async () => {
  const event = buildEvent('evt_concurrent_1', 'checkout.session.completed')
  const claimedIds = new Set<string>()

  let checkoutSideEffects = 0
  let markDoneCount = 0
  let markFailedCount = 0

  const deps = {
    claimEvent: async (incoming: Stripe.Event) => {
      if (claimedIds.has(incoming.id)) return 'duplicate' as const
      claimedIds.add(incoming.id)
      return 'claimed' as const
    },
    markDone: async () => {
      markDoneCount += 1
    },
    markFailed: async () => {
      markFailedCount += 1
    },
    handleCheckoutSessionCompleted: async () => {
      checkoutSideEffects += 1
    },
    handleSubscriptionUpdatedOrDeleted: async () => {
      throw new Error('should not be called for checkout.session.completed')
    },
  }

  const [first, second] = await Promise.all([
    processStripeWebhookEvent(event, deps),
    processStripeWebhookEvent(event, deps),
  ])

  assert.equal(checkoutSideEffects, 1)
  assert.equal(markDoneCount, 1)
  assert.equal(markFailedCount, 0)

  const duplicates = [first, second].filter((result) => result.duplicate)
  const processed = [first, second].filter((result) => !result.duplicate)
  assert.equal(duplicates.length, 1)
  assert.equal(processed.length, 1)
})
