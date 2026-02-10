import assert from 'node:assert/strict'
import test from 'node:test'
import { EMPLOYER_PLANS } from '../lib/billing/plan.ts'
import { resolveEmployerPlanId } from '../lib/billing/subscriptions.ts'

test('plan limits are free=1, starter=3, pro=unlimited', () => {
  assert.equal(EMPLOYER_PLANS.free.maxActiveInternships, 1)
  assert.equal(EMPLOYER_PLANS.starter.maxActiveInternships, 3)
  assert.equal(EMPLOYER_PLANS.pro.maxActiveInternships, null)
})

test('price_id maps to starter/pro with backwards compatibility', () => {
  const previousStarter = process.env.STARTER_PRICE_ID
  const previousPro = process.env.PRO_PRICE_ID
  const previousGrowth = process.env.GROWTH_PRICE_ID
  const previousLegacy = process.env.STRIPE_PRICE_VERIFIED_EMPLOYER

  process.env.STARTER_PRICE_ID = 'price_starter_new'
  process.env.PRO_PRICE_ID = 'price_pro_new'
  process.env.GROWTH_PRICE_ID = 'price_growth_legacy'
  process.env.STRIPE_PRICE_VERIFIED_EMPLOYER = 'price_starter_legacy'

  try {
    assert.equal(resolveEmployerPlanId({ status: 'active', priceId: 'price_starter_new' }), 'starter')
    assert.equal(resolveEmployerPlanId({ status: 'active', priceId: 'price_pro_new' }), 'pro')
    assert.equal(resolveEmployerPlanId({ status: 'active', priceId: 'price_growth_legacy' }), 'pro')
    assert.equal(resolveEmployerPlanId({ status: 'active', priceId: 'price_starter_legacy' }), 'starter')
    assert.equal(resolveEmployerPlanId({ status: 'trialing', priceId: 'unknown_price' }), 'starter')
    assert.equal(resolveEmployerPlanId({ status: 'canceled', priceId: 'price_pro_new' }), 'free')
  } finally {
    if (previousStarter === undefined) delete process.env.STARTER_PRICE_ID
    else process.env.STARTER_PRICE_ID = previousStarter

    if (previousPro === undefined) delete process.env.PRO_PRICE_ID
    else process.env.PRO_PRICE_ID = previousPro

    if (previousGrowth === undefined) delete process.env.GROWTH_PRICE_ID
    else process.env.GROWTH_PRICE_ID = previousGrowth

    if (previousLegacy === undefined) delete process.env.STRIPE_PRICE_VERIFIED_EMPLOYER
    else process.env.STRIPE_PRICE_VERIFIED_EMPLOYER = previousLegacy
  }
})
