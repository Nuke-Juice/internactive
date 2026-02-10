import { Suspense } from 'react'
import JobsView, { JobsViewSkeleton, type JobsQuery } from '@/components/jobs/JobsView'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<JobsQuery>
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<JobsViewSkeleton />}>
        <JobsView searchParams={searchParams} showHero basePath="/" anchorId="internships" />
      </Suspense>
    </main>
  )
}
