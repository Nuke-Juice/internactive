import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'
import { syncStudentResumeFromApplications } from '@/lib/student/profileResume'

export async function GET(request: Request) {
  const { user } = await requireRole('student', { requestedPath: '/student/resume' })
  const supabase = await supabaseServer()

  const syncResult = await syncStudentResumeFromApplications({
    supabase,
    userId: user.id,
    currentMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
  })

  if (!syncResult.profile.resumePath) {
    return NextResponse.redirect(new URL('/student/resume?error=No+resume+on+file', request.url))
  }

  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(syncResult.profile.resumePath, 60 * 10)

  if (error || !data?.signedUrl) {
    return NextResponse.redirect(new URL('/student/resume?error=Could+not+open+resume', request.url))
  }

  return NextResponse.redirect(data.signedUrl)
}
