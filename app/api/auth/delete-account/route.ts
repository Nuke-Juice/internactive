import { NextResponse } from 'next/server'
import { deleteUserAccountById } from '@/lib/auth/accountDeletion'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { checkRateLimitForRequest, getClientIp, isSameOriginRequest } from '@/lib/security/requestProtection'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const ipLimit = await checkRateLimitForRequest({
    key: `delete_account:ip:${ip}`,
    limit: 6,
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

  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ ok: false, error: 'Server missing admin credentials.' }, { status: 500 })
  }

  const admin = supabaseAdmin()
  const result = await deleteUserAccountById(admin, user.id)

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
