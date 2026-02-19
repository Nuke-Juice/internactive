import { NextResponse } from 'next/server'
import { ADMIN_ROLES } from '@/lib/auth/roles'
import { supabaseServer } from '@/lib/supabase/server'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

type ToggleBody = {
  employer_id?: unknown
  is_beta_employer?: unknown
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminCredentials()) {
    return NextResponse.json({ error: 'Server admin credentials are not configured.' }, { status: 500 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const { data: userRow, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const roleValue = userRow?.role
  const isAdmin = !roleError && typeof roleValue === 'string' && (ADMIN_ROLES as readonly string[]).includes(roleValue)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
  }

  let body: ToggleBody
  try {
    body = (await request.json()) as ToggleBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const employerId = typeof body.employer_id === 'string' ? body.employer_id.trim() : ''
  const isBetaEmployer = body.is_beta_employer

  if (!isUuid(employerId)) {
    return NextResponse.json({ error: 'Invalid employer_id.' }, { status: 400 })
  }
  if (typeof isBetaEmployer !== 'boolean') {
    return NextResponse.json({ error: 'Invalid is_beta_employer value.' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('employer_profiles')
    .update({ is_beta_employer: isBetaEmployer })
    .eq('user_id', employerId)
    .select('user_id, is_beta_employer')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data?.user_id) {
    return NextResponse.json({ error: 'Employer profile not found.' }, { status: 404 })
  }

  return NextResponse.json({
    employer_id: data.user_id,
    is_beta_employer: Boolean((data as { is_beta_employer?: boolean | null }).is_beta_employer),
  })
}
