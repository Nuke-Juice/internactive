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

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(withProtocol)
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function getAppUrl() {
  const configured = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL ?? '') ?? normalizeUrl(process.env.APP_URL ?? '')
  if (configured) return configured

  // On Vercel, prefer the stable production domain over per-deployment hosts.
  const vercelProductionUrl = normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '')
  if (vercelProductionUrl) return vercelProductionUrl

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
