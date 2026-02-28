import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import StudentDashboardExperience from '@/components/student/dashboard/StudentDashboardExperience'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { formatCompleteness } from '@/src/profile/profileCompleteness'
import { getStudentProfileCompleteness } from '@/src/profile/getStudentProfileCompleteness'

type ResumeAnalysisRow = {
  id: string
  resume_score: number | null
  suggestions: unknown
  keywords: unknown
  metrics: unknown
  extraction_status: 'pending' | 'ok' | 'failed'
  analysis_status: 'pending' | 'ok' | 'failed'
  created_at: string
}

type DashboardApplicationStatus = 'submitted' | 'viewed' | 'reviewing' | 'interview' | 'accepted' | 'rejected' | 'withdrawn'

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function parseTopKeywords(metrics: unknown, fallback: unknown) {
  if (metrics && typeof metrics === 'object' && 'top_keywords' in metrics) {
    const top = (metrics as { top_keywords?: unknown }).top_keywords
    if (Array.isArray(top)) {
      const parsed = top
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const term = 'term' in item ? String((item as { term?: unknown }).term ?? '').trim() : ''
          const countRaw = 'count' in item ? Number((item as { count?: unknown }).count) : 0
          if (!term || !Number.isFinite(countRaw) || countRaw <= 0) return null
          return { term, count: Math.round(countRaw) }
        })
        .filter((item): item is { term: string; count: number } => Boolean(item))
      if (parsed.length > 0) return parsed.slice(0, 3)
    }
  }

  const terms = asStringArray(fallback).slice(0, 3)
  return terms.map((term) => ({ term, count: 1 }))
}

function formatApplicationStatus(application: {
  status: string | null
  employer_viewed_at: string | null
}): { status: DashboardApplicationStatus; label: string } {
  const normalized = (application.status ?? '').trim().toLowerCase()
  if (normalized === 'accepted') return { status: 'accepted', label: 'Accepted' }
  if (normalized === 'interview') return { status: 'interview', label: 'Interview' }
  if (normalized === 'reviewing') return { status: 'reviewing', label: 'Reviewing' }
  if (normalized === 'rejected') return { status: 'rejected', label: 'Rejected' }
  if (normalized === 'withdrawn') return { status: 'withdrawn', label: 'Withdrawn' }
  if (application.employer_viewed_at) return { status: 'viewed', label: 'Viewed' }
  return { status: 'submitted', label: 'Submitted' }
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated recently'
  return `Applied ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function formatLocation(city: string | null | undefined, state: string | null | undefined, fallback: string | null | undefined) {
  const tokens = [city?.trim(), state?.trim()].filter((item): item is string => Boolean(item))
  if (tokens.length > 0) return tokens.join(', ')
  const fallbackValue = (fallback ?? '').trim()
  return fallbackValue || 'Location not set'
}

function initialsForCompany(name: string) {
  const tokens = name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (tokens.length === 0) return 'CO'
  return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('')
}

export default async function StudentDashboardPage() {
  const { user } = await requireRole('student', { requestedPath: '/student/dashboard' })
  const supabase = await supabaseServer()

  const [applicationsResult, latestAnalysisResult, studentCategoriesResult, internshipsResult] = await Promise.all([
    supabase
      .from('applications')
      .select(
        'id, status, employer_viewed_at, created_at, internship:internships(id, title, company_name, employer_id, location, location_city, location_state)'
      )
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('student_resume_analysis')
      .select('id, resume_score, suggestions, keywords, metrics, extraction_status, analysis_status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<ResumeAnalysisRow>(),
    supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
    supabase
      .from('internships')
      .select('id, title, internship_required_course_categories(category_id, category:canonical_course_categories(name))')
      .eq('is_active', true)
      .limit(250),
  ])

  const applications = (applicationsResult.data ?? []) as Array<{
    id: string
    status: string | null
    employer_viewed_at: string | null
    created_at: string
    internship?: {
      id?: string | null
      title?: string | null
      company_name?: string | null
      employer_id?: string | null
      location?: string | null
      location_city?: string | null
      location_state?: string | null
    } | null
  }>

  const employerIds = Array.from(
    new Set(
      applications
        .map((application) => application.internship?.employer_id)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  )

  const { data: employerProfiles } =
    employerIds.length > 0
      ? await supabase.from('employer_public_profiles').select('employer_id, avatar_url').in('employer_id', employerIds)
      : { data: [] as Array<{ employer_id: string; avatar_url: string | null }> }

  const employerAvatarById = new Map(
    (employerProfiles ?? []).map((profile) => [profile.employer_id, typeof profile.avatar_url === 'string' ? profile.avatar_url : null] as const)
  )

  const profileCompleteness = await getStudentProfileCompleteness({
    supabase,
    userId: user.id,
    preloaded: {
      resumePath: typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path : null,
    },
  })

  const profileStrengthPercent = formatCompleteness(profileCompleteness.percent)
  const hasResumeOnFile = profileCompleteness.breakdown.resumeUploaded
  const courseworkCategoryCount = profileCompleteness.breakdown.derivedCourseworkCategoryCount

  const normalizedApplicationStatuses = applications.map((application) => ({
    id: application.id,
    ...formatApplicationStatus(application),
  }))
  const submittedCount = normalizedApplicationStatuses.filter((application) => application.status === 'submitted').length
  const viewedOrReviewingCount = normalizedApplicationStatuses.filter(
    (application) => application.status === 'viewed' || application.status === 'reviewing'
  ).length
  const interviewCount = normalizedApplicationStatuses.filter((application) => application.status === 'interview').length
  const acceptedCount = normalizedApplicationStatuses.filter((application) => application.status === 'accepted').length
  const viewedCount = applications.filter((row) => row.employer_viewed_at !== null).length
  const viewRate = submittedCount > 0 ? (viewedCount / submittedCount) * 100 : 0
  const interviewRate = submittedCount > 0 ? (interviewCount / submittedCount) * 100 : 0
  const shouldShowDataWarning = submittedCount < 3

  const latestAnalysis = latestAnalysisResult.data
  const analysisSuggestions = asStringArray(latestAnalysis?.suggestions).slice(0, 3)
  const topKeywords = parseTopKeywords(latestAnalysis?.metrics, latestAnalysis?.keywords)

  const studentCategoryIds = new Set(
    (studentCategoriesResult.data ?? [])
      .map((row) => row.category_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  )
  const missingCategoryCounts = new Map<string, number>()

  for (const internship of internshipsResult.data ?? []) {
    const requirements = Array.isArray(internship.internship_required_course_categories)
      ? internship.internship_required_course_categories
      : []
    if (requirements.length === 0) continue

    const missing = requirements.filter((item) => {
      const categoryId = typeof item.category_id === 'string' ? item.category_id : null
      return categoryId ? !studentCategoryIds.has(categoryId) : false
    })
    if (missing.length === 0) continue

    for (const item of missing) {
      const categoryName =
        typeof item?.category === 'object' && item?.category && 'name' in item.category
          ? String(item.category.name ?? '').trim()
          : ''
      if (!categoryName) continue
      missingCategoryCounts.set(categoryName, (missingCategoryCounts.get(categoryName) ?? 0) + 1)
    }
  }

  const topCourseStrategies = Array.from(missingCategoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))

  const checklistItems = [
    { label: 'Resume uploaded', done: hasResumeOnFile, href: '/student/resume' },
    { label: 'Major or interest area', done: profileCompleteness.breakdown.hasMajor, href: '/account#major' },
    { label: 'Coursework categories', done: profileCompleteness.breakdown.hasCoursework, href: '/account#coursework' },
    { label: 'Skills', done: profileCompleteness.breakdown.hasSkills, href: '/account#skills' },
    { label: 'Availability start month', done: profileCompleteness.breakdown.hasStartMonth, href: '/account#availability' },
    { label: 'Availability hours per week', done: profileCompleteness.breakdown.hasHours, href: '/account#availability' },
    { label: 'Location preferences', done: profileCompleteness.breakdown.hasLocation, href: '/account#preferences' },
  ]

  const stalledThresholdDays = 7
  const nowMs = Date.now()
  const stalledApplications = applications.filter((application) => {
    const normalizedStatus = (application.status ?? '').trim().toLowerCase()
    const relevant = normalizedStatus === 'reviewing' || application.employer_viewed_at !== null
    if (!relevant) return false
    const referenceTime = application.employer_viewed_at ?? application.created_at
    const timestamp = new Date(referenceTime).getTime()
    if (!Number.isFinite(timestamp)) return false
    return nowMs - timestamp > stalledThresholdDays * 24 * 60 * 60 * 1000
  })

  const nextAction =
    submittedCount === 0
      ? {
          title: 'Browse matches',
          description: 'You have the profile basics in place. Build momentum by sending your first applications.',
          href: '/jobs',
          ctaLabel: 'Browse matches',
        }
      : stalledApplications.length > 0
        ? {
            title: 'Follow up',
            description: `${stalledApplications.length} application${stalledApplications.length === 1 ? '' : 's'} have been sitting in viewed/reviewing for more than ${stalledThresholdDays} days.`,
            href: '/applications?status=viewed',
            ctaLabel: 'Review stalled apps',
          }
        : profileStrengthPercent < 100
          ? {
              title: 'Complete profile',
              description: 'A fully complete profile keeps quick apply friction low and improves matching quality.',
              href: profileCompleteness.nextAction?.ctaHref ?? '/account',
              ctaLabel: 'Complete profile',
            }
          : {
              title: 'Improve odds',
              description:
                topCourseStrategies.length > 0
                  ? `Add or refine coursework for ${topCourseStrategies[0].name} to unlock more relevant roles.`
                  : topKeywords.length > 0
                    ? `Tighten your resume around ${topKeywords[0].term} and other repeated signals employers are screening for.`
                    : 'Sharpen your skills and coursework so your strongest signals stay current.',
              href: topCourseStrategies.length > 0 ? '/account#coursework' : '/account#skills',
              ctaLabel: 'Strengthen profile',
            }

  const topInsights = [
    {
      label: shouldShowDataWarning ? 'Build more signal' : `Interview rate ${Math.round(interviewRate * 10) / 10}%`,
      detail: shouldShowDataWarning ? 'Apply to a few more roles to make your response trend meaningful.' : `Viewed rate is ${Math.round(viewRate * 10) / 10}% across recent applications.`,
      href: '/applications',
    },
    {
      label: analysisSuggestions[0] ?? 'Refresh resume signals',
      detail: topKeywords.length > 0 ? `Top keywords: ${topKeywords.map((item) => item.term).join(', ')}.` : 'Upload or refine your resume to make future applications faster.',
      href: '/student/resume',
    },
    {
      label: topCourseStrategies[0]?.name ?? 'Coursework coverage',
      detail:
        topCourseStrategies.length > 0
          ? `${topCourseStrategies[0].name} appears in ${topCourseStrategies[0].count} internship requirement${topCourseStrategies[0].count === 1 ? '' : 's'}.`
          : `${courseworkCategoryCount} coursework categor${courseworkCategoryCount === 1 ? 'y is' : 'ies are'} currently mapped from your profile.`,
      href: '/account#coursework',
    },
  ]

  const recentApplications = applications.slice(0, 10).map((application) => {
    const status =
      normalizedApplicationStatuses.find((item) => item.id === application.id) ??
      formatApplicationStatus(application)
    const company = application.internship?.company_name?.trim() || 'Company'
    const employerId = application.internship?.employer_id?.trim() || ''
    return {
      id: application.id,
      title: application.internship?.title?.trim() || 'Internship',
      company,
      companyAvatarUrl: employerId ? employerAvatarById.get(employerId) ?? null : null,
      companyInitials: initialsForCompany(company),
      locationLabel: formatLocation(
        application.internship?.location_city,
        application.internship?.location_state,
        application.internship?.location
      ),
      status: status.status,
      statusLabel: status.label,
      createdAtLabel: formatRelativeDate(application.created_at),
      href: `/applications?application=${encodeURIComponent(application.id)}#application-${encodeURIComponent(application.id)}`,
    }
  })

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div>
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mt-3 max-w-2xl">
            <h1 className="text-3xl font-semibold text-slate-900">Student Dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Focus on what moves your search forward: pipeline momentum, the next best action, and the profile signals that improve your odds.
            </p>
          </div>
        </div>

        <StudentDashboardExperience
          profileStrengthPercent={profileStrengthPercent}
          pipelineSegments={[
            { key: 'submitted', label: 'Submitted', count: submittedCount, href: '/applications?status=submitted' },
            { key: 'viewed', label: 'Viewed / Reviewing', count: viewedOrReviewingCount, href: '/applications?status=viewed' },
            { key: 'interview', label: 'Interview', count: interviewCount, href: '/applications?status=interview' },
            { key: 'accepted', label: 'Accepted', count: acceptedCount, href: '/applications?status=accepted' },
          ]}
          applications={recentApplications}
          nextAction={nextAction}
          checklistItems={checklistItems}
          topInsights={topInsights}
          stalledCount={stalledApplications.length}
        />
      </section>
    </main>
  )
}
