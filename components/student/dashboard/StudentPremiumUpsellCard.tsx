type TrendPoint = {
  label: string
  count: number
  barWidth: string
}

type CourseStrategy = {
  name: string
  count: number
}

type ResumeKeyword = {
  term: string
  count: number
}

type Props = {
  shouldShowDataWarning: boolean
  interviewRate: number
  viewRate: number
  weeklyTrend: TrendPoint[]
  analysisSuggestions: string[]
  topKeywords: ResumeKeyword[]
  topCourseStrategies: CourseStrategy[]
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

export default function StudentPremiumUpsellCard({
  shouldShowDataWarning,
  interviewRate,
  viewRate,
  weeklyTrend,
  analysisSuggestions,
  topKeywords,
  topCourseStrategies,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Actionable insights</h2>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Advanced analytics</p>
          {shouldShowDataWarning ? (
            <p className="mt-2 text-xs text-slate-600">Need at least 3 applications to unlock trend confidence.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-700">Interview rate: <span className="font-semibold text-slate-900">{formatPercent(interviewRate)}</span></p>
              <p className="text-sm text-slate-700">View rate: <span className="font-semibold text-slate-900">{formatPercent(viewRate)}</span></p>
              <div className="mt-2 space-y-1">
                {weeklyTrend.slice(-3).map((point) => (
                  <div key={point.label} className="flex items-center gap-2">
                    <span className="w-12 text-[10px] text-slate-500">{point.label}</span>
                    <div className="h-2 w-full rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: point.barWidth }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Resume signals</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {(analysisSuggestions.length > 0 ? analysisSuggestions : ['Upload a PDF resume to generate your first analysis.'])
              .slice(0, 3)
              .map((item) => (
                <li key={item}>• {item}</li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            Keywords:{' '}
            {topKeywords.length > 0 ? topKeywords.map((item) => `${item.term} (${item.count})`).join(', ') : 'No keyword data yet'}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Course strategy</p>
          {topCourseStrategies.length > 0 ? (
            <ul className="mt-2 space-y-2 text-xs text-slate-700">
              {topCourseStrategies.slice(0, 3).map((item) => (
                <li key={item.name}>
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <div>Could improve visibility for {item.count} internship requirements.</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-600">Not enough catalog overlap yet. Add coursework to generate recommendations.</p>
          )}
        </article>
      </div>
    </section>
  )
}
