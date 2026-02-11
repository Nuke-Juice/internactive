import EmployerDashboardPage from '@/app/dashboard/employer/page'

type SearchParams = Promise<{ edit?: string; concierge?: string }>

export default async function EmployerNewInternshipPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined

  return await EmployerDashboardPage({
    searchParams: Promise.resolve({
      create: '1',
      edit: resolvedSearchParams?.edit,
      concierge: resolvedSearchParams?.concierge,
    }),
    createOnly: true,
  })
}
