import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { normalizeAtsStageMode, normalizeExternalApplyUrl } from '@/lib/apply/externalApply'
import { trackAnalyticsEvent } from '@/lib/analytics'

type Params = { params: Promise<{ listingId: string }> }

export async function GET(request: Request, { params }: Params) {
  const { listingId } = await params
  const url = new URL(request.url)
  const applicationId = url.searchParams.get('application')?.trim() ?? ''

  if (!applicationId) {
    return NextResponse.redirect(new URL(`/apply/${encodeURIComponent(listingId)}?error=Missing+application+context`, url.origin))
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL(`/signup/student?next=${encodeURIComponent(`/apply/${listingId}`)}`, url.origin))
  }

  const { data: application } = await supabase
    .from('applications')
    .select('id, student_id, internship_id, external_apply_clicks, ats_invite_status')
    .eq('id', applicationId)
    .eq('student_id', user.id)
    .eq('internship_id', listingId)
    .maybeSingle()

  if (!application?.id) {
    return NextResponse.redirect(new URL(`/apply/${encodeURIComponent(listingId)}?error=Application+not+found`, url.origin))
  }

  const { data: internship } = await supabase
    .from('internships')
    .select('id, apply_mode, ats_stage_mode, external_apply_url')
    .eq('id', listingId)
    .eq('is_active', true)
    .maybeSingle()

  if (!internship?.id) {
    return NextResponse.redirect(new URL(`/apply/${encodeURIComponent(listingId)}?error=Listing+not+found`, url.origin))
  }
  const atsStageMode = normalizeAtsStageMode(String(internship.ats_stage_mode ?? 'curated'))
  const inviteStatus = String(application.ats_invite_status ?? 'not_invited')
  if (atsStageMode === 'curated' && !['invited', 'clicked', 'self_reported_complete', 'employer_confirmed'].includes(inviteStatus)) {
    return NextResponse.redirect(
      new URL(`/applications?error=You+need+an+ATS+invite+from+the+employer+before+continuing.`, url.origin)
    )
  }

  const externalUrl = normalizeExternalApplyUrl(String(internship.external_apply_url ?? ''))
  if (!externalUrl) {
    return NextResponse.redirect(new URL(`/apply/${encodeURIComponent(listingId)}?error=External+application+link+is+not+configured`, url.origin))
  }

  await supabase
    .from('applications')
    .update({
      external_apply_clicks: (application.external_apply_clicks ?? 0) + 1,
      external_apply_last_clicked_at: new Date().toISOString(),
      ats_invite_status:
        inviteStatus === 'invited'
          ? 'clicked'
          : inviteStatus === 'not_invited'
            ? 'clicked'
            : inviteStatus,
    })
    .eq('id', applicationId)
    .eq('student_id', user.id)

  await trackAnalyticsEvent({
    eventName: 'external_apply_clicked',
    userId: user.id,
    properties: {
      listing_id: listingId,
      application_id: applicationId,
      apply_mode: internship.apply_mode ?? 'native',
    },
  })

  return NextResponse.redirect(externalUrl, { status: 307 })
}
