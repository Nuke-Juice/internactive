import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { getStudentEntitlements, maybeExpireTrial } from '@/lib/student/entitlements'
import { supabaseServer } from '@/lib/supabase/server'
import { formatCompleteness } from '@/src/profile/profileCompleteness'
import { getStudentProfileCompleteness } from '@/src/profile/getStudentProfileCompleteness'
import StudentDashboardSnapshot from '@/components/student/dashboard/StudentDashboardSnapshot'
import StudentDashboardPipelinePreview from '@/components/student/dashboard/StudentDashboardPipelinePreview'
import StudentProfileSetupPanel from '@/components/student/dashboard/StudentProfileSetupPanel'
import StudentPremiumUpsellCard from '@/components/student/dashboard/StudentPremiumUpsellCard'

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

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizePlanBadge(params: { isPremiumActive: boolean; isTrial: boolean; trialDaysRemaining: number }) {
  if (params.isPremiumActive && params.isTrial) return `Trial (${params.trialDaysRemaining} day${params.trialDaysRemaining === 1 ? '' : 's'} left)`
  if (params.isPremiumActive) return 'Pro'
  return 'Free'
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

function buildWeeklyTrend(applications: Array<{ created_at: string }>) {
  const now = new Date()
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const weekOffset = 5 - index
    const start = new Date(now)
    start.setDate(now.getDate() - weekOffset * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return {
      label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      start,
      end,
      count: 0,
    }
  })

  for (const row of applications) {
    const createdAt = new Date(row.created_at)
    if (Number.isNaN(createdAt.getTime())) continue
    const bucket = buckets.find((item) => createdAt >= item.start && createdAt < item.end)
    if (bucket) bucket.count += 1
  }

  const maxCount = Math.max(1, ...buckets.map((item) => item.count))
  return buckets.map((item) => ({
    label: item.label,
    count: item.count,
    barWidth: `${Math.round((item.count / maxCount) * 100)}%`,
  }))
}

export default async function StudentDashboardPage() {
  const { user } = await requireRole('student', { requestedPath: '/student/dashboard' })
  const supabase = await supabaseServer()

  await maybeExpireTrial(user.id, { supabase })
  const entitlements = await getStudentEntitlements(user.id, { supabase })

  const [applicationsResult, latestAnalysisResult, studentCategoriesResult, internshipsResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, employer_viewed_at, created_at, internship:internships(id, title, company_name)')
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

  const profileCompleteness = await getStudentProfileCompleteness({
    supabase,
    userId: user.id,
    preloaded: {
      resumePath: typeof user.user_metadata?.resume_path === 'string' ? user.user_metadata.resume_path : null,
    },
  })

  const profileStrengthPercent = formatCompleteness(profileCompleteness.percent)
  const missingProfileLabels = profileCompleteness.missing.map((item) => item.label)
  const nextBestAction = profileCompleteness.nextAction?.details ?? (profileCompleteness.nextAction ? `Add ${profileCompleteness.nextAction.label}` : 'Keep details current')
  const hasResumeOnFile = profileCompleteness.breakdown.resumeUploaded
  const courseworkCategoryCount = profileCompleteness.breakdown.derivedCourseworkCategoryCount
  const courseworkCourseCount = profileCompleteness.breakdown.courseworkCount

  const applications = (applicationsResult.data ?? []) as Array<{
    id: string
    status: string | null
    employer_viewed_at: string | null
    created_at: string
    internship?: { id?: string | null; title?: string | null; company_name?: string | null } | null
  }>

  const submittedCount = applications.length
  const viewedOrReviewingCount = applications.filter((row) => row.status === 'reviewing' || row.employer_viewed_at !== null).length
  const interviewCount = applications.filter((row) => row.status === 'interview').length
  const acceptedCount = applications.filter((row) => row.status === 'accepted').length
  const viewedCount = applications.filter((row) => row.employer_viewed_at !== null).length
  const viewRate = submittedCount > 0 ? (viewedCount / submittedCount) * 100 : 0
  const interviewRate = submittedCount > 0 ? (interviewCount / submittedCount) * 100 : 0
  const shouldShowDataWarning = submittedCount < 3
  const weeklyTrend = buildWeeklyTrend(applications)

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

  const profileChecklist = [
    { label: 'Major or interest area', done: profileCompleteness.breakdown.hasMajor },
    { label: 'Availability start month', done: profileCompleteness.breakdown.hasStartMonth },
    { label: 'Availability hours per week', done: profileCompleteness.breakdown.hasHours },
    { label: 'Location preferences', done: profileCompleteness.breakdown.hasLocation },
    { label: 'Resume uploaded', done: hasResumeOnFile },
    { label: 'Coursework categories', done: profileCompleteness.breakdown.hasCoursework },
    { label: 'Skills', done: profileCompleteness.breakdown.hasSkills },
  ]
  const completedChecklist = profileChecklist.filter((item) => item.done).map((item) => item.label)
  const missingChecklist = profileChecklist.filter((item) => !item.done).map((item) => item.label)

  const recentApplications = applications.slice(0, 3).map((application) => ({
    id: application.id,
    title: application.internship?.title ?? 'Internship',
    company: application.internship?.company_name ?? 'Company',
    status: application.status === 'submitted' && application.employer_viewed_at ? 'viewed' : application.status ?? 'submitted',
    createdAt: application.created_at,
  }))

  const primaryCta = !hasResumeOnFile
    ? { label: 'Upload resume', href: '/account#resume', helper: 'Required to unlock stronger matching and resume insights.' }
    : submittedCount === 0
      ? { label: 'Apply to top matches', href: '/jobs', helper: 'Build momentum with your first applications.' }
      : { label: 'View applications', href: '/applications', helper: 'Track statuses and follow employer updates.' }

  const snapshotNextStep = !hasResumeOnFile ? 'Upload resume' : nextBestAction

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <Link
            href="/"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Student Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">Snapshot, pipeline, and your next best move.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Plan: <span className="font-semibold text-slate-900">{normalizePlanBadge(entitlements)}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <StudentDashboardSnapshot
            profileStrengthPercent={profileStrengthPercent}
            nextStep={snapshotNextStep}
            showCompleteProfileLink={profileStrengthPercent < 100}
            pipelineMetrics={[
              { label: 'Submitted', count: submittedCount, href: '/applications?status=submitted' },
              { label: 'Viewed / Reviewing', count: viewedOrReviewingCount, href: '/applications?status=viewed' },
              { label: 'Interview', count: interviewCount, href: '/applications?status=interview' },
              { label: 'Accepted', count: acceptedCount, href: '/applications?status=accepted' },
            ]}
            primaryCta={primaryCta}
          />

          <StudentDashboardPipelinePreview applications={recentApplications} />

          <StudentProfileSetupPanel
            profileStrengthPercent={profileStrengthPercent}
            missingLabels={missingProfileLabels}
            completedChecklist={completedChecklist}
            missingChecklist={missingChecklist}
            courseworkCourseCount={courseworkCourseCount}
            courseworkCategoryCount={courseworkCategoryCount}
            nextBestAction={nextBestAction}
          />

          <StudentPremiumUpsellCard
            isPremiumActive={entitlements.isPremiumActive}
            shouldShowDataWarning={shouldShowDataWarning}
            interviewRate={interviewRate}
            viewRate={viewRate}
            weeklyTrend={weeklyTrend}
            analysisSuggestions={analysisSuggestions}
            topKeywords={topKeywords}
            topCourseStrategies={topCourseStrategies}
          />
        </div>
      </section>
    </main>
  )
}
