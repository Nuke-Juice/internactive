import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

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

  function chipClass(active: boolean) {
    return `inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors ${
      active
        ? 'border-blue-300 bg-blue-50 text-blue-700'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
    }`
  }

  function toggleClass(active: boolean) {
    return `flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors ${
      active
        ? 'border-blue-300 bg-blue-50 text-blue-700'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
    }`
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <Link
          href={href({ category: '', paidOnly: false, jobType: '', remoteOnly: false, experience: '', maxHours: '' })}
          className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          Clear all
        </Link>
      </div>

      <div className="mt-5 space-y-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => {
              const active = state.category === category
              return (
                <Link key={category} href={href({ category: active ? '' : category })} className={chipClass(active)}>
                  {category}
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work type</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={href({ jobType: state.jobType === 'internship' ? '' : 'internship' })}
              className={chipClass(state.jobType === 'internship')}
            >
              Internship
            </Link>
            <Link
              href={href({ jobType: state.jobType === 'part-time' ? '' : 'part-time' })}
              className={chipClass(state.jobType === 'part-time')}
            >
              Part-time
            </Link>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Work mode</h3>
          <div className="mt-2">
            <Link href={href({ remoteOnly: !state.remoteOnly })} className={toggleClass(state.remoteOnly)}>
              <span className="text-sm font-medium">Remote only</span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  state.remoteOnly ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                aria-hidden
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    state.remoteOnly ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </Link>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compensation</h3>
          <div className="mt-2">
            <Link href={href({ paidOnly: !state.paidOnly })} className={toggleClass(state.paidOnly)}>
              <span className="text-sm font-medium">Paid only</span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  state.paidOnly ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                aria-hidden
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    state.paidOnly ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </Link>
          </div>
        </section>
      </div>

      <details className="group mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-800">
          Refine
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <div className="space-y-4 border-t border-slate-200 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['entry', 'mid', 'senior'].map((value) => {
                const active = state.experience === value
                return (
                  <Link key={value} href={href({ experience: active ? '' : value })} className={chipClass(active)}>
                    {value}
                  </Link>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max hours/week</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['10', '20', '30'].map((value) => {
                const active = state.maxHours === value
                return (
                  <Link key={value} href={href({ maxHours: active ? '' : value })} className={chipClass(active)}>
                    {'<= '}
                    {value}
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
