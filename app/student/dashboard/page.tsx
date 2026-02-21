import Link from 'next/link'
import { ArrowLeft, BarChart3, Briefcase, FileText, LayoutDashboard, ShieldCheck, Star } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { getMinimumProfileCompleteness, getMinimumProfileFieldLabel } from '@/lib/profileCompleteness'
import { getStudentEntitlements, maybeExpireTrial } from '@/lib/student/entitlements'
import PremiumLockedOverlay from '@/components/student/PremiumLockedOverlay'
import DashboardCardLink from '@/components/student/DashboardCardLink'
import AppNav from '@/components/navigation/AppNav'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function reasonLooksLikeGap(reason: string) {
  const normalized = reason.toLowerCase()
  return normalized.includes('missing') || normalized.includes('mismatch') || normalized.includes('required')
}

function normalizePlanBadge(params: { isPremiumActive: boolean; isTrial: boolean; trialDaysRemaining: number }) {
  if (params.isPremiumActive && params.isTrial) return `Trial (${params.trialDaysRemaining} day${params.trialDaysRemaining === 1 ? '' : 's'} left)`
  if (params.isPremiumActive) return 'Premium'
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

  const [profileResult, applicationsResult, latestAnalysisResult, studentCategoriesResult, internshipsResult, latestResumeFileResult] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('school, major_id, majors, availability_start_month, availability_hours_per_week')
      .eq('user_id', user.id)
      .maybeSingle<{
        school: string | null
        major_id: string | null
        majors: string[] | string | null
        availability_start_month: string | null
        availability_hours_per_week: number | string | null
      }>(),
    supabase
      .from('applications')
      .select('id, status, employer_viewed_at, match_score, match_reasons, created_at, internship:internships(id, title, company_name)')
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
    supabase
      .from('student_resume_files')
      .select('id')
      .eq('user_id', user.id)
      .eq('latest_version', true)
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ])

  const hasResumeOnFile = Boolean(latestResumeFileResult.data?.id)
  const courseworkCount = (studentCategoriesResult.data ?? []).length

  const profileCompleteness = getMinimumProfileCompleteness(profileResult.data ?? null)
  const missingProfileLabels = profileCompleteness.missing.map((field) => getMinimumProfileFieldLabel(field))
  const profileBasicsPercent = Math.round(((4 - missingProfileLabels.length) / 4) * 100)
  const resumeStrengthPercent = hasResumeOnFile ? 100 : 0
  const courseworkStrengthPercent =
    courseworkCount >= 5 ? 100 : courseworkCount >= 3 ? 80 : courseworkCount >= 1 ? 50 : 0
  const profileStrengthPercent = Math.round(
    profileBasicsPercent * 0.6 + resumeStrengthPercent * 0.25 + courseworkStrengthPercent * 0.15
  )

  const nextBestAction = hasResumeOnFile
    ? missingProfileLabels[0]
      ? `Add ${missingProfileLabels[0]}`
      : 'Add one quantified result to your top resume bullets'
    : 'Upload a resume PDF'

  const applications = (applicationsResult.data ?? []) as Array<{
    id: string
    status: string | null
    employer_viewed_at: string | null
    match_score: number | null
    match_reasons: unknown
    created_at: string
    internship?: { id?: string | null; title?: string | null; company_name?: string | null } | null
  }>

  const submittedCount = applications.length
  const reviewingCount = applications.filter((row) => row.status === 'reviewing').length
  const interviewCount = applications.filter((row) => row.status === 'interview' || row.status === 'accepted').length
  const acceptedCount = applications.filter((row) => row.status === 'accepted').length
  const viewedCount = applications.filter((row) => row.employer_viewed_at !== null).length
  const viewRate = submittedCount > 0 ? (viewedCount / submittedCount) * 100 : 0
  const interviewRate = submittedCount > 0 ? (interviewCount / submittedCount) * 100 : 0
  const shouldShowDataWarning = submittedCount < 3
  const weeklyTrend = buildWeeklyTrend(applications)

  const platformAverages = await (async () => {
    try {
      const admin = supabaseAdmin()
      const [{ count: allCount }, { count: allViewedCount }, { count: allInterviewCount }] = await Promise.all([
        admin.from('applications').select('id', { count: 'exact', head: true }),
        admin.from('applications').select('id', { count: 'exact', head: true }).not('employer_viewed_at', 'is', null),
        admin.from('applications').select('id', { count: 'exact', head: true }).in('status', ['interview', 'accepted']),
      ])

      const total = allCount ?? 0
      if (total < 25) return null
      return {
        interviewRate: total > 0 ? ((allInterviewCount ?? 0) / total) * 100 : 0,
        viewRate: total > 0 ? ((allViewedCount ?? 0) / total) * 100 : 0,
      }
    } catch {
      return null
    }
  })()

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

  const nearMisses = applications
    .map((application) => {
      const reasons = asStringArray(application.match_reasons)
      const gapReason = reasons.find(reasonLooksLikeGap)
      if (!gapReason) return null
      if (typeof application.match_score !== 'number' || application.match_score < 55) return null
      return {
        title: application.internship?.title ?? 'Internship',
        company: application.internship?.company_name ?? 'Company',
        score: Math.round(application.match_score),
        reason: gapReason,
      }
    })
    .filter((item): item is { title: string; company: string; score: number; reason: string } => Boolean(item))
    .slice(0, 4)

  const actionCenterItems = [
    hasResumeOnFile
      ? { label: 'Refresh your resume with one quantified bullet', impact: 'High impact' }
      : { label: 'Upload a resume PDF to unlock stronger recommendations', impact: 'High impact' },
    submittedCount < 2
      ? { label: 'Apply to at least 2 internships this week', impact: 'High impact' }
      : { label: 'Keep your application pace steady this week', impact: 'Medium impact' },
    courseworkCount < 3
      ? { label: 'Add more coursework categories to improve matching coverage', impact: 'Medium impact' }
      : { label: 'Review coursework tags for accuracy and relevance', impact: 'Medium impact' },
    missingProfileLabels.length > 0
      ? { label: `Complete profile: ${missingProfileLabels[0]}`, impact: 'Medium impact' }
      : { label: 'Profile baseline is complete, keep details current', impact: 'Maintenance' },
  ].slice(0, 4)

  const profileChecklist = [
    { label: 'School', done: !missingProfileLabels.includes('School') },
    { label: 'Major', done: !missingProfileLabels.includes('Major') },
    { label: 'Availability start month', done: !missingProfileLabels.includes('Availability start month') },
    { label: 'Availability hours per week', done: !missingProfileLabels.includes('Availability hours per week') },
    { label: 'Resume uploaded', done: hasResumeOnFile },
    { label: 'Coursework tags (3+)', done: courseworkCount >= 3 },
  ]
  const completedChecklist = profileChecklist.filter((item) => item.done).map((item) => item.label)
  const missingChecklist = profileChecklist.filter((item) => !item.done).map((item) => item.label)

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-12">
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
              <p className="mt-2 text-slate-600">Your internship performance dashboard with clear next steps and transparent premium insights.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Plan: <span className="font-semibold text-slate-900">{normalizePlanBadge(entitlements)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <AppNav role="student" variant="workspaceTabs" />
        </div>

        <div className="mt-6 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardCardLink href="/student/dashboard/action-center" ariaLabel="Open Action Center details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Action Center</p>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </div>
            <ul className="mt-3 space-y-2 overflow-auto text-sm text-slate-700">
              {actionCenterItems.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                    {item.label}
                  </span>
                  {entitlements.isPremiumActive ? (
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{item.impact}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/student/dashboard/profile-strength" ariaLabel="Open Profile Strength details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Profile Strength</p>
              <Star className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{profileStrengthPercent}%</p>
            <p className="mt-2 text-sm text-slate-700">Next best action: {nextBestAction}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Resume uploaded: <span className="font-semibold text-slate-900">{hasResumeOnFile ? 'Yes' : 'No'}</span>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                Coursework tags: <span className="font-semibold text-slate-900">{courseworkCount}</span>
              </div>
            </div>
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2 overflow-auto text-xs">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                <p className="font-semibold uppercase tracking-wide text-emerald-700">Complete</p>
                <ul className="mt-1 space-y-1 text-slate-700">
                  {completedChecklist.length > 0 ? (
                    completedChecklist.slice(0, 5).map((item) => <li key={item}>• {item}</li>)
                  ) : (
                    <li>• No completed items yet</li>
                  )}
                </ul>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                <p className="font-semibold uppercase tracking-wide text-amber-700">Missing</p>
                <ul className="mt-1 space-y-1 text-slate-700">
                  {missingChecklist.length > 0 ? (
                    missingChecklist.slice(0, 5).map((item) => <li key={item}>• {item}</li>)
                  ) : (
                    <li>• No missing items</li>
                  )}
                </ul>
              </div>
            </div>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/applications" ariaLabel="Open Application Tracking">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Application Tracking</p>
              <LayoutDashboard className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{submittedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Applications submitted</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold text-slate-900">{reviewingCount}</div>
                <div className="text-slate-600">Reviewing</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold text-slate-900">{interviewCount}</div>
                <div className="text-slate-600">Interview</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="font-semibold text-slate-900">{acceptedCount}</div>
                <div className="text-slate-600">Accepted</div>
              </div>
            </div>
            <div className="mt-auto rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              Application tracking always stays free. Open your full tracker and statuses.
            </div>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/student/dashboard/application-analytics" ariaLabel="Open Advanced Analytics details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Advanced Analytics</p>
              <LayoutDashboard className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-slate-500">Interview rate</p>
                <p className="text-lg font-semibold text-slate-900">{shouldShowDataWarning ? '—' : formatPercent(interviewRate)}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-slate-500">View rate</p>
                <p className="text-lg font-semibold text-slate-900">{shouldShowDataWarning ? '—' : formatPercent(viewRate)}</p>
              </div>
            </div>
            <PremiumLockedOverlay
              locked={!entitlements.isPremiumActive}
              title="Premium analytics"
              description="Advanced analytics are premium. Application tracking always stays free."
              className="mt-auto h-44"
            >
              <div className="h-full rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 text-xs text-slate-700">
                {shouldShowDataWarning ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <p>Not enough data yet. Advanced trends appear after at least 3 submitted applications.</p>
                  </div>
                ) : (
                  <div className="h-full">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Weekly trend</p>
                    <div className="mt-2 space-y-1">
                      {weeklyTrend.map((point) => (
                        <div key={point.label} className="flex items-center gap-2">
                          <span className="w-14 text-[10px] text-slate-500">{point.label}</span>
                          <div className="h-2.5 w-full rounded-full bg-slate-200">
                            <div className="h-2.5 rounded-full bg-blue-500" style={{ width: point.barWidth }} />
                          </div>
                          <span className="w-4 text-right text-[10px] text-slate-600">{point.count}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      {platformAverages
                        ? `Platform avg interview ${formatPercent(platformAverages.interviewRate)} • view ${formatPercent(platformAverages.viewRate)}`
                        : 'Platform benchmark appears when enough aggregate data is available.'}
                    </p>
                  </div>
                )}
              </div>
            </PremiumLockedOverlay>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/student/dashboard/resume-analyzer" ariaLabel="Open Resume Analyzer details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resume Analyzer</p>
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Resume uploaded: <span className="font-semibold text-slate-900">{hasResumeOnFile ? 'Yes' : 'No'}</span>
            </p>
            <div className="mt-2">
              <Link href="/account" className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline">
                {hasResumeOnFile ? 'Replace resume in account settings' : 'Upload resume in account settings'}
              </Link>
            </div>
            <PremiumLockedOverlay
              locked={!entitlements.isPremiumActive}
              title="Premium resume review"
              description="Unlock score details, top suggestions, and keyword analysis."
              className="mt-auto h-40"
            >
              <div className="h-full rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Latest score</p>
                <p className="text-2xl font-semibold text-slate-900">{typeof latestAnalysis?.resume_score === 'number' ? latestAnalysis.resume_score : 'n/a'}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {(analysisSuggestions.length > 0
                    ? analysisSuggestions
                    : ['Upload a PDF resume to generate your first analysis.'])
                    .slice(0, 3)
                    .map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                </ul>
                <div className="mt-2 text-xs text-slate-600">
                  Keyword counts:{' '}
                  {topKeywords.length > 0 ? topKeywords.map((item) => `${item.term} (${item.count})`).join(', ') : 'No keyword data yet'}
                </div>
              </div>
            </PremiumLockedOverlay>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/student/dashboard/course-strategy" ariaLabel="Open Course Strategy details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Course Strategy</p>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
            {!entitlements.isPremiumActive ? (
              <p className="mt-3 text-sm text-slate-700">Add coursework to unlock more internships. Premium shows which categories improve match coverage the most.</p>
            ) : null}
            <PremiumLockedOverlay
              locked={!entitlements.isPremiumActive}
              title="Premium course strategy"
              description="Unlock recommended coursework with estimated internship impact."
              className="mt-auto h-40"
            >
              <div className="h-full space-y-2 overflow-auto">
                {topCourseStrategies.length > 0 ? (
                  topCourseStrategies.map((item) => (
                    <div key={item.name} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">Estimated impact: could improve visibility for {item.count} internship requirement matches.</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-700">Not enough catalog overlap yet. Add more coursework tags and we will generate targeted recommendations.</p>
                )}
              </div>
            </PremiumLockedOverlay>
            </article>
          </DashboardCardLink>

          <DashboardCardLink href="/student/dashboard/match-optimization" ariaLabel="Open Match Optimization details">
            <article className="flex h-[340px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-500">Match Optimization</p>
              <Star className="h-4 w-4 text-blue-600" />
            </div>
            {!entitlements.isPremiumActive ? (
              <p className="mt-3 text-sm text-slate-700">
                Apply to more internships to build stronger optimization signals. Premium shows where you almost matched and what to improve next.
              </p>
            ) : (
              <div className="mt-3 space-y-2 overflow-auto">
                {nearMisses.map((item) => (
                  <div key={`${item.title}-${item.company}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-600">
                      {item.company} • Match {item.score}%
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{item.reason}</p>
                  </div>
                ))}
                {nearMisses.length === 0 ? (
                  <p className="text-sm text-slate-700">Not enough match-gap data yet. Apply to more roles and we will surface near misses here.</p>
                ) : null}
              </div>
            )}
            </article>
          </DashboardCardLink>
        </div>
      </section>
    </main>
  )
}
