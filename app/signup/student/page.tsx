import { redirect } from 'next/navigation'
import StudentSignupForm from '@/components/auth/StudentSignupForm'
import { normalizeNextPath } from '@/lib/auth/nextPath'
import { resolvePostAuthRedirect } from '@/lib/auth/postAuthRedirect'
import { supabaseServer } from '@/lib/supabase/server'

function decodeError(value: string | undefined) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isSelfPath(path: string | null) {
  return path === '/signup/student' || Boolean(path?.startsWith('/signup/student?'))
}

export default async function StudentSignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>
}) {
  const resolvedSearchParams = (searchParams ? await searchParams : {}) ?? {}
  const requestedNextPath = normalizeNextPath(resolvedSearchParams.next)
  const normalizedNextForRedirect = isSelfPath(requestedNextPath) ? null : requestedNextPath

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { destination } = await resolvePostAuthRedirect({
      supabase,
      userId: user.id,
      requestedNextPath: normalizedNextForRedirect,
      user,
    })

    if (!isSelfPath(destination)) {
      redirect(destination)
    }

    redirect('/signup/student/details')
  }

  return (
    <StudentSignupForm
      queryError={decodeError(resolvedSearchParams.error)}
      requestedNextPath={requestedNextPath}
    />
  )
}
