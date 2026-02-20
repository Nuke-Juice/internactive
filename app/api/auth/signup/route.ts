import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeNextPathOrDefault } from '@/lib/auth/nextPath'
import { mapSignupError, normalizeSignupEmail, extractEmailDomain, isValidEmailFormat, interpretSignupResult } from '@/lib/auth/signup'
import { resolveServerAppOrigin } from '@/lib/url/origin'

type SignupPayload = {
  email?: unknown
  password?: unknown
  roleHint?: unknown
  nextPath?: unknown
  authMethod?: unknown
}

export async function POST(request: Request) {
  let payload: SignupPayload
  try {
    payload = (await request.json()) as SignupPayload
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 })
  }

  const rawEmail = typeof payload.email === 'string' ? payload.email : ''
  const normalizedEmail = normalizeSignupEmail(rawEmail)
  const password = typeof payload.password === 'string' ? payload.password : ''
  const roleHint = payload.roleHint === 'employer' ? 'employer' : 'student'
  const authMethod = typeof payload.authMethod === 'string' ? payload.authMethod : 'password'
  const nextPath = normalizeNextPathOrDefault(typeof payload.nextPath === 'string' ? payload.nextPath : null, roleHint === 'employer' ? '/signup/employer/details' : '/signup/student/details')
  const emailDomain = extractEmailDomain(normalizedEmail)

  if (!normalizedEmail || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }
  if (!isValidEmailFormat(normalizedEmail)) {
    return NextResponse.json(
      {
        error: 'Enter a valid email address and try again.',
        errorKey: 'INVALID_EMAIL',
      },
      { status: 400 }
    )
  }

  const origin = resolveServerAppOrigin({
    configuredPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    configuredAppUrl: process.env.APP_URL,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    requestHost: request.headers.get('x-forwarded-host') ?? request.headers.get('host'),
    requestProto: request.headers.get('x-forwarded-proto') ?? 'https',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  })

  if (!origin) {
    return NextResponse.json(
      {
        error: 'Signup configuration is incomplete. Please contact support.',
        errorKey: 'CONFIG',
      },
      { status: 500 }
    )
  }

  const supabase = await supabaseServer()
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        role_hint: roleHint,
      },
    },
  })

  const interpreted = interpretSignupResult({
    error: error ?? null,
    userId: data.user?.id ?? null,
  })

  if (!interpreted.ok && error) {
    const mapped = mapSignupError(error)
    console.warn('[auth.signup.failed]', {
      emailDomain,
      authMethod,
      roleHint,
      supabaseErrorCode: (error as { code?: string | null }).code ?? null,
      supabaseErrorStatus: (error as { status?: number | null }).status ?? null,
      supabaseErrorName: (error as { name?: string | null }).name ?? null,
      supabaseErrorMessage: error.message,
    })

    return NextResponse.json(
      {
        error: mapped.publicMessage,
        errorKey: mapped.key,
        devDetails:
          process.env.NODE_ENV !== 'production'
            ? {
                code: (error as { code?: string | null }).code ?? null,
                status: (error as { status?: number | null }).status ?? null,
                name: (error as { name?: string | null }).name ?? null,
                message: error.message,
                emailDomain,
                authMethod,
              }
            : undefined,
      },
      { status: mapped.statusCode }
    )
  }

  if (!interpreted.ok && interpreted.errorKey === 'PROFILE_SETUP') {
    console.warn('[auth.signup.no_user]', {
      emailDomain,
      authMethod,
      roleHint,
    })
    return NextResponse.json(
      {
        error: interpreted.message,
        errorKey: interpreted.errorKey,
      },
      { status: interpreted.statusCode }
    )
  }

  const verifyRequiredPath = `/verify-required?next=${encodeURIComponent(nextPath)}&action=signup_profile_completion&email=${encodeURIComponent(normalizedEmail.toLowerCase())}`
  return NextResponse.json({
    ok: true,
    verifyRequiredPath,
  })
}
