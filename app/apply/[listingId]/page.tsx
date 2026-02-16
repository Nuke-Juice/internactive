import { redirect } from 'next/navigation'

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ listingId: string }>
}) {
  const { listingId } = await params
  redirect(`/jobs/${listingId}?apply=1`)
}
