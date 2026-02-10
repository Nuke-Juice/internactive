'use server'

import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { resendVerificationEmail, type ResendVerificationResult } from '@/lib/auth/emailVerification'

async function resolveAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const proto = headerStore.get('x-forwarded-proto') ?? 'http'
  if (host) return `${proto}://${host}`

  return 'http://localhost:3000'
}

function normalizeNext(nextUrl: string) {
  if (!nextUrl.startsWith('/')) return '/'
  if (nextUrl.startsWith('//')) return '/'
  return nextUrl
}

export async function resendVerificationEmailAction(
  email: string,
  nextUrl = '/'
): Promise<ResendVerificationResult> {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be logged in.' }
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || normalizedEmail !== (user.email ?? '').trim().toLowerCase()) {
    return { ok: false, error: 'Email does not match the signed-in account.' }
  }

  const appOrigin = await resolveAppOrigin()
  const callback = new URL('/auth/callback', appOrigin)
  callback.searchParams.set('next', normalizeNext(nextUrl))

  return resendVerificationEmail({
    email: normalizedEmail,
    emailRedirectTo: callback.toString(),
    resend: (input) => supabase.auth.resend(input),
  })
}
