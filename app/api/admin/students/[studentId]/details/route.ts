import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import { getMinimumProfileCompleteness, MINIMUM_PROFILE_FIELDS } from '@/lib/profileCompleteness'

type Params = { params: Promise<{ studentId: string }> }

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function parseMajors(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean)
  return []
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export async function GET(_request: Request, { params }: Params) {
  const { studentId } = await params
  if (!isUuid(studentId)) {
    return NextResponse.json({ error: 'Invalid student id.' }, { status: 400 })
  }
  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ error: 'Admin service credentials missing.' }, { status: 500 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }
  const { data: roleRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = typeof roleRow?.role === 'string' ? roleRow.role : null
  const isAdmin = role !== null && (ADMIN_ROLES as readonly string[]).includes(role)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  const admin = supabaseAdmin()
  const [
    profileResult,
    userCoreResult,
    authUserResult,
    skillCountResult,
    courseworkCountResult,
    applicationsCountResult,
    internshipViewsResult,
    trackedEventsCountResult,
  ] = await Promise.all([
    admin
      .from('student_profiles')
      .select(
        'user_id, school, university_id, major_id, majors, year, experience_level, availability_start_month, availability_hours_per_week, interests, coursework, coursework_unverified'
      )
      .eq('user_id', studentId)
      .maybeSingle(),
    admin.from('users').select('id, last_seen_at').eq('id', studentId).maybeSingle(),
    admin.auth.admin.getUserById(studentId),
    admin.from('student_skill_items').select('student_id', { count: 'exact', head: true }).eq('student_id', studentId),
    admin.from('student_coursework_category_links').select('student_id', { count: 'exact', head: true }).eq('student_id', studentId),
    admin.from('applications').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    admin
      .from('internship_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', studentId)
      .eq('event_type', 'view'),
    admin.from('internship_events').select('id', { count: 'exact', head: true }).eq('user_id', studentId),
  ])

  const profile = profileResult.data
  const authUser = authUserResult.data.user
  const metadata = (authUser?.user_metadata ?? {}) as { resume_path?: string; first_name?: string; last_name?: string }
  const majors = parseMajors(profile?.majors)
  const profileCompleteness = getMinimumProfileCompleteness(profile ?? null)

  return NextResponse.json({
    profile: {
      name: [metadata.first_name?.trim() ?? '', metadata.last_name?.trim() ?? ''].filter(Boolean).join(' ').trim() || null,
      email: authUser?.email ?? null,
      school: profile?.school ?? null,
      majors,
      year: profile?.year ?? null,
      availabilityStartMonth: profile?.availability_start_month ?? null,
      availabilityHoursPerWeek: profile?.availability_hours_per_week ?? null,
      experienceLevel: profile?.experience_level ?? null,
      resumePresent: Boolean(metadata.resume_path && metadata.resume_path.trim().length > 0),
      profileCompletenessPercent: Math.round(
        ((MINIMUM_PROFILE_FIELDS.length - profileCompleteness.missing.length) / MINIMUM_PROFILE_FIELDS.length) * 100
      ),
      missingProfileFields: profileCompleteness.missing,
      canonicalSkillsCount: skillCountResult.count ?? 0,
      courseworkCategoriesCount: courseworkCountResult.count ?? 0,
    },
    usage: {
      accountCreatedAt: formatDate(authUser?.created_at),
      lastActiveAt: formatDate(authUser?.last_sign_in_at ?? null),
      lastSeenAt: formatDate(userCoreResult.data?.last_seen_at ?? null),
      internshipViewsCount: internshipViewsResult.count ?? 0,
      applicationsSubmittedCount: applicationsCountResult.count ?? 0,
      trackedEventsCount: trackedEventsCountResult.count ?? 0,
      savedInternshipsCount: null,
      profileUpdatesCount: null,
    },
    quickActions: {
      previewMatchesHref: `/admin/matching/preview?student=${encodeURIComponent(studentId)}`,
      viewFullProfileHref: null,
    },
  })
}
