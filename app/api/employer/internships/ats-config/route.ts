import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeExternalApplyUrl } from '@/lib/apply/externalApply'

type RequestBody = {
  internship_id?: unknown
  mode?: unknown
  external_apply_url?: unknown
  external_apply_type?: unknown
}

type Mode = 'native' | 'curated' | 'immediate'

function isMode(value: string): value is Mode {
  return value === 'native' || value === 'curated' || value === 'immediate'
}

export async function POST(request: Request) {
  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (userRow?.role !== 'employer') {
    return NextResponse.json({ error: 'Employer access required.' }, { status: 403 })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const internshipId = typeof body.internship_id === 'string' ? body.internship_id.trim() : ''
  const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : ''
  const mode = isMode(modeRaw) ? modeRaw : null
  const externalApplyTypeRaw = typeof body.external_apply_type === 'string' ? body.external_apply_type.trim().toLowerCase() : ''
  const externalApplyType = externalApplyTypeRaw === 'redirect' ? 'redirect' : 'new_tab'
  const externalApplyUrlInput = typeof body.external_apply_url === 'string' ? body.external_apply_url : ''
  const externalApplyUrl = normalizeExternalApplyUrl(externalApplyUrlInput)

  if (!internshipId) return NextResponse.json({ error: 'internship_id is required.' }, { status: 400 })
  if (!mode) return NextResponse.json({ error: 'mode must be native, curated, or immediate.' }, { status: 400 })

  if ((mode === 'curated' || mode === 'immediate') && !externalApplyUrl) {
    return NextResponse.json({ error: 'A valid http(s) official application URL is required.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data: internship, error: internshipError } = await admin
    .from('internships')
    .select('id, employer_id')
    .eq('id', internshipId)
    .maybeSingle()

  if (internshipError || !internship?.id) {
    return NextResponse.json({ error: 'Internship not found.' }, { status: 404 })
  }
  if (internship.employer_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to update this internship.' }, { status: 403 })
  }

  const payload =
    mode === 'native'
      ? {
          apply_mode: 'native',
          ats_stage_mode: null,
          external_apply_url: null,
          external_apply_type: null,
        }
      : mode === 'curated'
        ? {
            apply_mode: 'hybrid',
            ats_stage_mode: 'curated',
            external_apply_url: externalApplyUrl,
            external_apply_type: externalApplyType,
          }
        : {
            apply_mode: 'ats_link',
            ats_stage_mode: 'immediate',
            external_apply_url: externalApplyUrl,
            external_apply_type: externalApplyType,
          }

  const { error: updateError } = await admin.from('internships').update(payload).eq('id', internshipId).eq('employer_id', user.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
