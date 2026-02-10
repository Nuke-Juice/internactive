import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

function normalizeNext(value: string | null) {
  const next = (value ?? '/').trim()
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextUrl = normalizeNext(url.searchParams.get('next'))

  const supabase = await supabaseServer()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const redirectUrl = new URL(nextUrl, url.origin)
  if (user?.email_confirmed_at) {
    redirectUrl.searchParams.set('verified', '1')
  }

  return NextResponse.redirect(redirectUrl)
}
