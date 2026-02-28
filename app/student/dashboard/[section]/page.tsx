import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, BarChart3, Briefcase, FileText, LayoutDashboard, ShieldCheck, Star } from 'lucide-react'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { getStudentProfileCompleteness } from '@/src/profile/getStudentProfileCompleteness'

type DashboardSectionSlug =
  | 'action-center'
  | 'profile-strength'
  | 'application-analytics'
  | 'resume-analyzer'
  | 'course-strategy'
  | 'match-optimization'

type SectionMeta = {
  title: string
  subtitle: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const SECTION_META: Record<DashboardSectionSlug, SectionMeta> = {
  'action-center': {
    title: 'Action Center',
    subtitle: 'Prioritized steps to improve your internship outcomes this week.',
    icon: BarChart3,
  },
  'profile-strength': {
    title: 'Profile Strength',
    subtitle: 'A weighted view of profile readiness, resume signal, and coursework coverage.',
    icon: Star,
  },
  'application-analytics': {
    title: 'Application Analytics',
    subtitle: 'Track submissions and understand response patterns over time.',
    icon: LayoutDashboard,
  },
  'resume-analyzer': {
    title: 'Resume Analyzer',
    subtitle: 'Understand what is helping or hurting resume performance.',
    icon: FileText,
  },
  'course-strategy': {
    title: 'Course Strategy',
    subtitle: 'See which coursework areas likely unlock more internship opportunities.',
    icon: Briefcase,
  },
  'match-optimization': {
    title: 'Match Optimization',
    subtitle: 'See where you almost matched and what to improve next.',
    icon: ShieldCheck,
  },
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function isSectionSlug(value: string): value is DashboardSectionSlug {
  return value in SECTION_META
}

function reasonLooksLikeGap(reason: string) {
  const normalized = reason.toLowerCase()
  return normalized.includes('missing') || normalized.includes('mismatch') || normalized.includes('required')
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

export default async function StudentDashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!isSectionSlug(section)) notFound()
  if (section === 'profile-strength') redirect('/account')

  const meta = SECTION_META[section]
  const Icon = meta.icon

  const { user } = await requireRole('student', { requestedPath: `/student/dashboard/${section}` })
  const supabase = await supabaseServer()

  const [applicationsResult, latestAnalysisResult, studentCategoriesResult, internshipsResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, employer_viewed_at, match_score, match_reasons, created_at, internship:internships(id, title, company_name)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('student_resume_analysis')
      .select('resume_score, suggestions, keywords, metrics, extraction_status, analysis_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{
        resume_score: number | null
        suggestions: unknown
        keywords: unknown
        metrics: unknown
        extraction_status: 'pending' | 'ok' | 'failed'
        analysis_status: 'pending' | 'ok' | 'failed'
      }>(),
    supabase.from('student_coursework_category_links').select('category_id').eq('student_id', user.id),
    supabase
      .from('internships')
      .select('id, internship_required_course_categories(category_id, category:canonical_course_categories(name))')
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
  const missingProfileLabels = profileCompleteness.missing.map((item) => item.label)
  const hasResumeOnFile = profileCompleteness.breakdown.resumeUploaded
  const courseworkCategoryCount = profileCompleteness.breakdown.derivedCourseworkCategoryCount

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

  const latestAnalysis = latestAnalysisResult.data
  const analysisSuggestions = asStringArray(latestAnalysis?.suggestions)
  const keywordList = asStringArray(latestAnalysis?.keywords)

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
    for (const item of requirements) {
      const categoryId = typeof item.category_id === 'string' ? item.category_id : null
      if (!categoryId || studentCategoryIds.has(categoryId)) continue
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
    .slice(0, 5)
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
    .slice(0, 8)

  const actionCenterItems = [
    hasResumeOnFile ? 'Refresh your resume with one quantified bullet.' : 'Upload a resume PDF to unlock stronger recommendations.',
    submittedCount < 2 ? 'Apply to at least 2 internships this week.' : 'Keep your application pace steady this week.',
    courseworkCategoryCount < 1 ? 'Add coursework to improve matching coverage.' : 'Review coursework categories for accuracy.',
    missingProfileLabels.length > 0 ? `Complete profile: ${missingProfileLabels[0]}.` : 'Profile baseline is complete, keep details current.',
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <Link
            href="/student/dashboard"
            aria-label="Go back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">{meta.title}</h1>
              <p className="mt-2 text-slate-600">{meta.subtitle}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2 text-blue-600">
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </div>

        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {section === 'action-center' ? (
            <ul className="space-y-3">
              {actionCenterItems.map((item) => (
                <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {section === 'application-analytics' ? (
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Submitted: <span className="font-semibold">{submittedCount}</span></div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Reviewing: <span className="font-semibold">{reviewingCount}</span></div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Interview: <span className="font-semibold">{interviewCount}</span></div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Accepted: <span className="font-semibold">{acceptedCount}</span></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p>Interview rate: <span className="font-semibold">{formatPercent(interviewRate)}</span></p>
                <p>View rate: <span className="font-semibold">{formatPercent(viewRate)}</span></p>
              </div>
            </div>
          ) : null}

          {section === 'resume-analyzer' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Resume uploaded: <span className="font-semibold text-slate-900">{hasResumeOnFile ? 'Yes' : 'No'}</span>
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-3xl font-semibold text-slate-900">{typeof latestAnalysis?.resume_score === 'number' ? latestAnalysis.resume_score : 'n/a'}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {(analysisSuggestions.length > 0 ? analysisSuggestions : ['Upload a PDF resume to generate your first analysis.']).slice(0, 8).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                {keywordList.length > 0 ? <p className="mt-3 text-xs text-slate-600">Keywords: {keywordList.slice(0, 15).join(', ')}</p> : null}
              </div>
            </div>
          ) : null}

          {section === 'course-strategy' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700">Current coursework categories: <span className="font-semibold">{courseworkCategoryCount}</span></p>
              <div className="space-y-2">
                {topCourseStrategies.length > 0 ? (
                  topCourseStrategies.map((item) => (
                    <div key={item.name} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">Estimated impact: {item.count} internship requirement matches.</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Not enough data yet. Add coursework and we will expand recommendations.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {section === 'match-optimization' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                {nearMisses.length > 0 ? (
                  nearMisses.map((item) => (
                    <div key={`${item.title}-${item.company}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-600">
                        {item.company} • Match {item.score}%
                      </p>
                      <p className="mt-1 text-xs text-slate-700">{item.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Not enough near-miss data yet. Apply to more roles and we will surface targeted opportunities.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  )
}
