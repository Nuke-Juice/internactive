export default function JobCardSkeleton() {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-1/3 rounded bg-slate-200" />
            </div>
          </div>
          <div className="h-14 w-14 shrink-0 rounded-full bg-slate-200" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-5 w-16 rounded-full bg-slate-200" />
          <div className="h-5 w-20 rounded-full bg-slate-200" />
        </div>
        <div className="mt-2 h-3 w-11/12 rounded bg-slate-200" />
        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-3 rounded bg-slate-200" />
            <div className="h-3 rounded bg-slate-200" />
            <div className="h-3 rounded bg-slate-200" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-8 w-24 rounded-md bg-slate-200" />
          <div className="h-8 w-20 rounded-md bg-slate-200" />
        </div>
      </div>
    </article>
  )
}
