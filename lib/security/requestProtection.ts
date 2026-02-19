import { resolveServerAppOrigin } from '@/lib/url/origin'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

type RateBucket = {
  count: number
  resetAtMs: number
}

const rateBuckets = new Map<string, RateBucket>()

type RateLimitResult = { ok: true; retryAfterSeconds: 0 } | { ok: false; retryAfterSeconds: number }

function firstHeaderValue(value: string | null) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .find(Boolean) ?? null
}

function normalizeOrigin(value: string | null) {
  if (!value) return null
  try {
    const parsed = new URL(value)
    parsed.pathname = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function originFromReferer(value: string | null) {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return normalizeOrigin(parsed.origin)
  } catch {
    return null
  }
}

function parseAllowedOriginsEnv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => normalizeOrigin(item.trim()))
    .filter((item): item is string => Boolean(item))
}

function getAllowedOrigins(request: Request) {
  const origins = new Set<string>()

  for (const origin of parseAllowedOriginsEnv(process.env.ALLOWED_ORIGINS)) {
    origins.add(origin)
  }

  for (const candidate of [
    process.env.NEXT_PUBLIC_APP_URL ?? null,
    process.env.APP_URL ?? null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    process.env.VERCEL_URL ?? null,
  ]) {
    const normalized = normalizeOrigin(candidate)
    if (normalized) origins.add(normalized)
  }

  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }

  const derived = resolveServerAppOrigin({
    configuredPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    configuredAppUrl: process.env.APP_URL ?? null,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    requestHost: firstHeaderValue(request.headers.get('x-forwarded-host')) ?? request.headers.get('host'),
    requestProto: firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? 'https',
    nodeEnv: process.env.NODE_ENV ?? null,
  })
  if (derived) origins.add(derived)

  return origins
}

function isStateChangingMethod(method: string) {
  const upper = method.toUpperCase()
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE'
}

export function getClientIp(request: Request) {
  const fromForwarded = firstHeaderValue(request.headers.get('x-forwarded-for'))
  if (fromForwarded) return fromForwarded
  const fromRealIp = firstHeaderValue(request.headers.get('x-real-ip'))
  if (fromRealIp) return fromRealIp
  return 'unknown'
}

export function isSameOriginRequest(request: Request) {
  const allowedOrigins = getAllowedOrigins(request)
  if (allowedOrigins.size === 0) return false

  const method = request.method.toUpperCase()
  const origin = normalizeOrigin(request.headers.get('origin'))
  const refererOrigin = originFromReferer(request.headers.get('referer'))

  if (isStateChangingMethod(method)) {
    if (origin) return allowedOrigins.has(origin)
    if (refererOrigin) return allowedOrigins.has(refererOrigin)
    return false
  }

  if (origin) return allowedOrigins.has(origin)
  if (refererOrigin) return allowedOrigins.has(refererOrigin)
  return true
}

export function checkRateLimit(params: {
  key: string
  limit: number
  windowMs: number
  nowMs?: number
}): RateLimitResult {
  const nowMs = params.nowMs ?? Date.now()
  const existing = rateBuckets.get(params.key)

  if (!existing || existing.resetAtMs <= nowMs) {
    rateBuckets.set(params.key, {
      count: 1,
      resetAtMs: nowMs + params.windowMs,
    })
    return { ok: true as const, retryAfterSeconds: 0 }
  }

  if (existing.count >= params.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000))
    return { ok: false as const, retryAfterSeconds }
  }

  existing.count += 1
  rateBuckets.set(params.key, existing)
  return { ok: true as const, retryAfterSeconds: 0 }
}

async function checkRateLimitInDatabase(params: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult | null> {
  if (!hasSupabaseAdminCredentials()) return null

  const windowSeconds = Math.max(1, Math.ceil(params.windowMs / 1000))
  const supabase = supabaseAdmin()
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket_key: params.key,
    p_limit: params.limit,
    p_window_seconds: windowSeconds,
  })

  if (error) return null
  const row = Array.isArray(data) ? data[0] : null
  if (!row || typeof row !== 'object') return null

  const allowed = Boolean((row as { allowed?: unknown }).allowed)
  const retryAfterRaw = (row as { retry_after_seconds?: unknown }).retry_after_seconds
  const retryAfterSeconds = typeof retryAfterRaw === 'number' && Number.isFinite(retryAfterRaw)
    ? Math.max(0, Math.floor(retryAfterRaw))
    : 0

  if (allowed) return { ok: true, retryAfterSeconds: 0 }
  return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) }
}

export async function checkRateLimitForRequest(params: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  const dbResult = await checkRateLimitInDatabase(params)
  if (dbResult) return dbResult
  return checkRateLimit(params)
}

export function resetInMemoryRateLimitsForTests() {
  rateBuckets.clear()
}
