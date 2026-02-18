import { NextResponse } from 'next/server'
import { resendVerificationEmailAction } from '@/lib/auth/emailVerificationServer'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'
import { checkRateLimitForRequest, getClientIp, isSameOriginRequest } from '@/lib/security/requestProtection'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const ipLimit = await checkRateLimitForRequest({
    key: `resend_verification:ip:${ip}`,
    limit: 25,
    windowMs: 10 * 60 * 1000,
  })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    )
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userLimit = await checkRateLimitForRequest({
    key: `resend_verification:user:${user.id}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  })
  if (!userLimit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many verification emails sent. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(userLimit.retryAfterSeconds) } }
    )
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // no-op
  }

  const next = normalizeNextPathOrDefault(
    body && typeof body === 'object' && 'next' in body ? String((body as { next?: unknown }).next ?? '') : '/'
  )
  const result = await resendVerificationEmailAction(user.email ?? '', next)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: result.message })
}
