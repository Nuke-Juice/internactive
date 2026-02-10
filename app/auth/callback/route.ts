import { NextResponse } from 'next/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { supabaseServer } from '@/lib/supabase/server'

function normalizeNext(value: string | null) {
  const next = (value ?? '/').trim()
  if (!next.startsWith('/')) return '/'
  if (next.startsWith('//')) return '/'
  return next
}

function readRoleHint(nextUrl: string, userMetadata: Record<string, unknown> | null): 'student' | 'employer' | null {
  const next = new URL(nextUrl, 'https://app.local')
  const roleFromQuery = next.searchParams.get('role')
  if (roleFromQuery === 'student' || roleFromQuery === 'employer') return roleFromQuery
  const roleFromMetadata = typeof userMetadata?.role_hint === 'string' ? userMetadata.role_hint : null
  if (roleFromMetadata === 'student' || roleFromMetadata === 'employer') return roleFromMetadata
  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const nextUrl = normalizeNext(url.searchParams.get('next'))

  const supabase = await supabaseServer()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const authUser = user
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const roleHint = readRoleHint(nextUrl, metadata)
    const admin = hasSupabaseAdminCredentials() ? supabaseAdmin() : null

    async function upsertUsersRow(role: 'student' | 'employer') {
      const payload = { id: authUser.id, role, verified: false }
      const result = await supabase.from('users').upsert(payload, { onConflict: 'id' })
      if (!result.error) return true
      if (!admin) return false
      const adminResult = await admin.from('users').upsert(payload, { onConflict: 'id' })
      return !adminResult.error
    }

    async function upsertStudentProfile(payload: Record<string, unknown>) {
      const result = await supabase.from('student_profiles').upsert(payload, { onConflict: 'user_id' })
      if (!result.error) return true
      if (!admin) return false
      const adminResult = await admin.from('student_profiles').upsert(payload, { onConflict: 'user_id' })
      return !adminResult.error
    }

    async function upsertEmployerProfile(payload: Record<string, unknown>) {
      const result = await supabase.from('employer_profiles').upsert(payload, { onConflict: 'user_id' })
      if (!result.error) return true
      if (!admin) return false
      const adminResult = await admin.from('employer_profiles').upsert(payload, { onConflict: 'user_id' })
      return !adminResult.error
    }

    if (roleHint === 'student') {
      const signupProfile =
        metadata.signup_profile && typeof metadata.signup_profile === 'object'
          ? (metadata.signup_profile as Record<string, unknown>)
          : {}
      const wroteUser = await upsertUsersRow('student')
      const wroteProfile = await upsertStudentProfile({
        user_id: authUser.id,
        school: typeof signupProfile.school === 'string' ? signupProfile.school : 'Not set',
        gender: typeof signupProfile.gender === 'string' ? signupProfile.gender : null,
        major_id: typeof signupProfile.major_id === 'string' ? signupProfile.major_id : null,
        majors: Array.isArray(signupProfile.majors)
          ? signupProfile.majors.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : null,
        year: typeof signupProfile.year === 'string' ? signupProfile.year : 'Not set',
        coursework: Array.isArray(signupProfile.coursework)
          ? signupProfile.coursework.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : null,
        experience_level: typeof signupProfile.experience_level === 'string' ? signupProfile.experience_level : 'none',
        availability_start_month:
          typeof signupProfile.availability_start_month === 'string' ? signupProfile.availability_start_month : 'May',
        availability_hours_per_week:
          typeof signupProfile.availability_hours_per_week === 'number'
            ? signupProfile.availability_hours_per_week
            : 20,
        interests: typeof signupProfile.interests === 'string' ? signupProfile.interests : null,
      })
      if (!wroteUser || !wroteProfile) {
        return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
      }
    } else if (roleHint === 'employer') {
      const signupProfile =
        metadata.signup_profile && typeof metadata.signup_profile === 'object'
          ? (metadata.signup_profile as Record<string, unknown>)
          : {}
      const wroteUser = await upsertUsersRow('employer')
      const wroteProfile = await upsertEmployerProfile({
        user_id: authUser.id,
        company_name: typeof signupProfile.company_name === 'string' ? signupProfile.company_name : null,
        website: typeof signupProfile.website === 'string' ? signupProfile.website : null,
        contact_email: typeof signupProfile.contact_email === 'string' ? signupProfile.contact_email : authUser.email ?? null,
        industry: typeof signupProfile.industry === 'string' ? signupProfile.industry : null,
        location: typeof signupProfile.location === 'string' ? signupProfile.location : null,
      })
      if (!wroteUser || !wroteProfile) {
        return NextResponse.redirect(new URL('/login?error=Could+not+finish+OAuth+sign-in', url.origin))
      }
    }
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const { destination } = await resolvePostAuthRedirect({
    supabase,
    userId: user.id,
    requestedNextPath: nextUrl,
  })

  const redirectUrl = new URL(destination, url.origin)
  if (user?.email_confirmed_at) {
    redirectUrl.searchParams.set('verified', '1')
  }

  return NextResponse.redirect(redirectUrl)
}
