import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { checkRateLimit, getClientIp } from '@/lib/security/requestProtection'

const FRIENDLY_ERROR = 'Please verify you’re human and try again.'

function getRemoteIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return null
  return forwarded.split(',')[0]?.trim() || null
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const ipLimit = checkRateLimit({
    key: `turnstile_verify:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  })
  if (!ipLimit.ok) {
    return Response.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    )
  }

  let token = ''
  let action: string | null = null

  try {
    const body = (await request.json()) as { token?: string; action?: string }
    token = String(body.token ?? '').trim()
    action = body.action ? String(body.action) : null
  } catch {
    return Response.json({ ok: false, error: FRIENDLY_ERROR }, { status: 400 })
  }

  const verification = await verifyTurnstileToken({
    token,
    expectedAction: action,
    remoteIp: getRemoteIp(request),
  })

  if (!verification.ok) {
    console.debug('[turnstile] verification failed', {
      action,
      remoteIp: getRemoteIp(request),
      errorCodes: verification.errorCodes,
    })
    return Response.json({ ok: false, error: FRIENDLY_ERROR }, { status: 400 })
  }

  return Response.json({ ok: true })
}
