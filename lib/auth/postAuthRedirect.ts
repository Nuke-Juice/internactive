import type { SupabaseClient } from '@supabase/supabase-js'
import { getMinimumProfileCompleteness } from '@/lib/profileCompleteness'
import { isAdminRole, isAppRole, isUserRole, type AppRole, type UserRole } from '@/lib/auth/roles'

type RoleLookupRow = { role: UserRole | null } | null

function isNonEmpty(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeNextPath(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  return trimmed
}

function defaultDestinationForRole(role: AppRole) {
  return role === 'student' ? '/' : '/dashboard/employer'
}

function isAccountPath(path: string | null) {
  return path === '/account' || Boolean(path?.startsWith('/account?'))
}

async function isOnboardingComplete(supabase: SupabaseClient, userId: string, role: AppRole) {
  if (role === 'student') {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('school, major_id, majors, availability_start_month, availability_hours_per_week')
      .eq('user_id', userId)
      .maybeSingle()

    return getMinimumProfileCompleteness(profile).ok
  }

  const { data: profile } = await supabase
    .from('employer_profiles')
    .select('company_name')
    .eq('user_id', userId)
    .maybeSingle()

  return isNonEmpty(profile?.company_name)
}

export async function resolvePostAuthRedirect(params: {
  supabase: SupabaseClient
  userId: string
  requestedNextPath?: string | null
}) {
  const normalizedNext = normalizeNextPath(params.requestedNextPath ?? null)
  const { data: userRow } = await params.supabase
    .from('users')
    .select('role')
    .eq('id', params.userId)
    .maybeSingle<RoleLookupRow>()

  const role = isUserRole(userRow?.role) ? userRow.role : null
  if (!role) {
    return {
      destination: '/account',
      role: null as UserRole | null,
      onboardingComplete: false,
    }
  }

  if (isAdminRole(role)) {
    return {
      destination: normalizedNext ?? '/admin/internships',
      role,
      onboardingComplete: true,
    }
  }

  if (!isAppRole(role)) {
    return {
      destination: '/account',
      role,
      onboardingComplete: false,
    }
  }

  const onboardingComplete = await isOnboardingComplete(params.supabase, params.userId, role)
  if (!onboardingComplete) {
    return {
      destination: '/account',
      role,
      onboardingComplete: false,
    }
  }

  const fallback = defaultDestinationForRole(role)
  if (!normalizedNext || isAccountPath(normalizedNext)) {
    return {
      destination: fallback,
      role,
      onboardingComplete: true,
    }
  }

  return {
    destination: normalizedNext,
    role,
    onboardingComplete: true,
  }
}
