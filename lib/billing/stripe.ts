import 'server-only'

import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  stripeClient = new Stripe(stripeSecretKey)
  return stripeClient
}

export function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('Missing NEXT_PUBLIC_APP_URL')
  }
  return appUrl
}

export function getVerifiedEmployerPriceId() {
  const priceId = process.env.STRIPE_PRICE_VERIFIED_EMPLOYER
  if (!priceId) {
    throw new Error('Missing STRIPE_PRICE_VERIFIED_EMPLOYER')
  }
  return priceId
}
