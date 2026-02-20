'use client'

type Point = { label: string; value: number }
type RankedListing = { internshipId: string; title: string; value: number }

type Props = {
  viewsSeries: Point[]
  applicationsSeries: Point[]
  conversionSeries: Point[]
  topByViews: RankedListing[]
  topByApplications: RankedListing[]
  kpi: {
    rangeLabel: string
    viewsTotal: number
    applicationsTotal: number
    conversionTotal: number
    viewsPrevious: number
    applicationsPrevious: number
    conversionPrevious: number
    conversionCurrent: number
  }
}

function toLinePath(data: Point[], width: number, height: number) {
  if (data.length === 0) return ''
  const max = Math.max(...data.map((point) => point.value), 1)
  return data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width
      const y = height - (point.value / max) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function percentDelta(current: number, previous: number) {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function kpiDeltaLabel(current: number, previous: number, suffix = '') {
  const delta = percentDelta(current, previous)
  if (delta === null) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}% vs previous ${suffix}`.trim()
}

function LineChart(props: {
  title: string
  data: Point[]
  stroke: string
  totalLabel: string
  totalValue: string
  rangeLabel: string
  deltaLabel: string | null
}) {
  const width = 560
  const height = 180
  const path = toLinePath(props.data, width, height)
  const max = Math.max(...props.data.map((point) => point.value), 1)
  const hasEnoughData = props.data.some((point) => point.value > 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{props.title}</h3>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold text-slate-900">{props.totalValue}</p>
          <p className="text-xs text-slate-500">{props.totalLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">{props.rangeLabel}</p>
          {props.deltaLabel ? <p className="mt-1 text-xs font-medium text-slate-700">{props.deltaLabel}</p> : null}
        </div>
      </div>

      {!hasEnoughData ? (
        <div className="mt-4 flex h-44 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center">
          <div>
            <p className="text-sm font-medium text-slate-700">Not enough data yet</p>
            <p className="mt-1 text-xs text-slate-500">Collecting data as students view and apply</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" role="img" aria-label={props.title}>
            <line x1="0" y1={height} x2={width} y2={height} stroke="#e2e8f0" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2={height} stroke="#e2e8f0" strokeWidth="1" />
            <path d={path} fill="none" stroke={props.stroke} strokeWidth="3" strokeLinecap="round" />
            {props.data.map((point, index) => {
              const x = (index / Math.max(props.data.length - 1, 1)) * width
              const y = height - (point.value / max) * height
              return <circle key={`${point.label}:${index}`} cx={x} cy={y} r="3" fill={props.stroke} />
            })}
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>{props.data[0]?.label ?? ''}</span>
            <span>{props.data[props.data.length - 1]?.label ?? ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Bars({ title, rows }: { title: string; rows: RankedListing[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No data yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.internshipId} className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-700">{row.title || 'Untitled listing'}</span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${Math.max((row.value / max) * 100, 6)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AnalyticsCharts({
  viewsSeries,
  applicationsSeries,
  conversionSeries,
  topByViews,
  topByApplications,
  kpi,
}: Props) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart
          title="Listing views over time"
          data={viewsSeries}
          stroke="#2563eb"
          totalLabel="Total views"
          totalValue={String(kpi.viewsTotal)}
          rangeLabel={kpi.rangeLabel}
          deltaLabel={kpiDeltaLabel(kpi.viewsTotal, kpi.viewsPrevious)}
        />
        <LineChart
          title="Applications over time"
          data={applicationsSeries}
          stroke="#0f766e"
          totalLabel="Total applications"
          totalValue={String(kpi.applicationsTotal)}
          rangeLabel={kpi.rangeLabel}
          deltaLabel={kpiDeltaLabel(kpi.applicationsTotal, kpi.applicationsPrevious)}
        />
      </div>
      <LineChart
        title="View to application conversion (%)"
        data={conversionSeries}
        stroke="#0f766e"
        totalLabel="Average conversion"
        totalValue={`${kpi.conversionTotal.toFixed(1)}%`}
        rangeLabel={kpi.rangeLabel}
        deltaLabel={kpiDeltaLabel(kpi.conversionCurrent, kpi.conversionPrevious, 'conversion')}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Bars title="Top listings by views" rows={topByViews} />
        <Bars title="Top listings by applications" rows={topByApplications} />
      </div>
    </div>
  )
}
