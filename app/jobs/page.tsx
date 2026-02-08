import { Suspense } from 'react'
import JobsView, { JobsViewSkeleton, type JobsQuery } from '@/components/jobs/JobsView'

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<JobsQuery>
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<JobsViewSkeleton />}>
        <JobsView searchParams={searchParams} basePath="/jobs" anchorId="internships" />
      </Suspense>
    </main>
  )
}
