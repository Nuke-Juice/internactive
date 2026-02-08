import Link from 'next/link'

type FilterState = {
  category: string
  paidOnly: boolean
  jobType: 'internship' | 'part-time' | ''
  remoteOnly: boolean
  experience: string
  maxHours: string
}

type Props = {
  categories: string[]
  state: FilterState
  basePath?: string
  anchorId?: string
}

export default function FiltersPanel({ categories, state, basePath = '/jobs', anchorId }: Props) {
  function href(overrides: Partial<FilterState>) {
    const merged: FilterState = { ...state, ...overrides }
    const params = new URLSearchParams()

    if (merged.category) params.set('category', merged.category)
    if (merged.paidOnly) params.set('paid', '1')
    if (merged.jobType) params.set('type', merged.jobType)
    if (merged.remoteOnly) params.set('remote', '1')
    if (merged.experience) params.set('exp', merged.experience)
    if (merged.maxHours) params.set('hours', merged.maxHours)

    const query = params.toString()
    const hash = anchorId ? `#${anchorId}` : ''
    return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`
  }

  const chipClass =
    'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors'
  const categoryTileClass =
    'inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium text-center transition-colors'
  const toggleClass =
    'flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors'

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Filters</h2>
        <Link href={href({})} className="text-xs font-medium text-blue-700 hover:underline">
          Clear all
        </Link>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500">Category</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {categories.map((category) => {
            const active = state.category === category
            return (
              <Link
                key={category}
                href={href({ category: active ? '' : category })}
                className={`${categoryTileClass} ${
                  active
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {category}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Link
          href={href({ paidOnly: !state.paidOnly })}
          className={`${toggleClass} ${
            state.paidOnly
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Paid only
          <span className="text-xs">{state.paidOnly ? 'On' : 'Off'}</span>
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={href({ jobType: state.jobType === 'internship' ? '' : 'internship' })}
            className={`${toggleClass} ${
              state.jobType === 'internship'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Internship
          </Link>
          <Link
            href={href({ jobType: state.jobType === 'part-time' ? '' : 'part-time' })}
            className={`${toggleClass} ${
              state.jobType === 'part-time'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Part-time
          </Link>
        </div>

        <Link
          href={href({ remoteOnly: !state.remoteOnly })}
          className={`${toggleClass} ${
            state.remoteOnly
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Remote
          <span className="text-xs">{state.remoteOnly ? 'On' : 'Off'}</span>
        </Link>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Refine</summary>

        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Experience</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['entry', 'mid', 'senior'].map((value) => {
                const active = state.experience === value
                return (
                  <Link
                    key={value}
                    href={href({ experience: active ? '' : value })}
                    className={`${chipClass} ${
                      active
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {value}
                  </Link>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Max hours/week</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['10', '20', '30'].map((value) => {
                const active = state.maxHours === value
                return (
                  <Link
                    key={value}
                    href={href({ maxHours: active ? '' : value })}
                    className={`${chipClass} ${
                      active
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {'<= '}{value}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </details>
    </aside>
  )
}
