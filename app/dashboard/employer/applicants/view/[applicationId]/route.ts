import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/requireRole'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ applicationId: string }> }
) {
  const { user } = await requireRole('employer', { requestedPath: '/dashboard/employer/applicants' })
  const { applicationId } = await context.params

  const supabase = await supabaseServer()

  const { data: application } = await supabase
    .from('applications')
    .select('id, internship_id, resume_url, employer_viewed_at')
    .eq('id', applicationId)
    .maybeSingle()

  if (!application?.id || !application.internship_id) {
    return NextResponse.redirect(new URL('/dashboard/employer/applicants?error=Application+not+found', request.url))
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('id')
    .eq('id', application.internship_id)
    .eq('employer_id', user.id)
    .maybeSingle()

  if (!internship?.id) {
    return NextResponse.redirect(
      new URL('/dashboard/employer/applicants?error=Not+authorized+to+view+that+application', request.url)
    )
  }

  if (!application.resume_url) {
    return NextResponse.redirect(new URL('/dashboard/employer/applicants?error=Resume+not+available', request.url))
  }

  if (!application.employer_viewed_at) {
    await supabase
      .from('applications')
      .update({
        employer_viewed_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', application.id)
      .eq('internship_id', internship.id)
  }

  const { data: signed } = await supabase.storage
    .from('resumes')
    .createSignedUrl(application.resume_url, 60 * 60)

  if (!signed?.signedUrl) {
    return NextResponse.redirect(new URL('/dashboard/employer/applicants?error=Could+not+open+resume', request.url))
  }

  return NextResponse.redirect(signed.signedUrl)
}
