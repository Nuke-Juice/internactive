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
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/+$/, '')}`
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000'
  }

  throw new Error('Missing NEXT_PUBLIC_APP_URL')
}

export function getStarterEmployerPriceId() {
  const priceId = process.env.STARTER_PRICE_ID || process.env.STRIPE_PRICE_VERIFIED_EMPLOYER
  if (!priceId) {
    throw new Error('Missing STARTER_PRICE_ID (or STRIPE_PRICE_VERIFIED_EMPLOYER fallback)')
  }
  return priceId
}

export function getProEmployerPriceId() {
  const priceId = process.env.PRO_PRICE_ID || process.env.GROWTH_PRICE_ID
  if (!priceId) {
    throw new Error('Missing PRO_PRICE_ID (or GROWTH_PRICE_ID fallback)')
  }
  return priceId
}

export function getGrowthEmployerPriceId() {
  return getProEmployerPriceId()
}
