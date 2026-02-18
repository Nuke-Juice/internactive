import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { registerResumeUploadAndAnalyze } from '@/lib/student/resumeAnalysis'
import { isResumeStoragePathOwnedByUser } from '@/lib/student/resumeStorageOwnership'
import { checkRateLimitForRequest, getClientIp, isSameOriginRequest } from '@/lib/security/requestProtection'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin.' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const ipLimit = await checkRateLimitForRequest({
    key: `resume_analyze:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    )
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userLimit = await checkRateLimitForRequest({
    key: `resume_analyze:user:${user.id}`,
    limit: 15,
    windowMs: 10 * 60 * 1000,
  })
  if (!userLimit.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many resume analysis attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(userLimit.retryAfterSeconds) } }
    )
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role?: string | null }>()

  if (userRow?.role !== 'student') {
    return NextResponse.json({ ok: false, error: 'Student access required' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        storagePath?: string
        originalFilename?: string | null
        mimeType?: string | null
        fileSize?: number | null
      }
    | null

  const storagePath = typeof payload?.storagePath === 'string' ? payload.storagePath.trim() : ''
  if (!storagePath) {
    return NextResponse.json({ ok: false, error: 'Missing resume storage path' }, { status: 400 })
  }
  if (!isResumeStoragePathOwnedByUser(user.id, storagePath)) {
    return NextResponse.json({ ok: false, error: 'Invalid resume storage path' }, { status: 403 })
  }

  const result = await registerResumeUploadAndAnalyze({
    userId: user.id,
    storagePath,
    originalFilename: typeof payload?.originalFilename === 'string' ? payload.originalFilename : null,
    mimeType: typeof payload?.mimeType === 'string' ? payload.mimeType : null,
    fileSize: Number.isFinite(payload?.fileSize) ? Number(payload?.fileSize) : null,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? 'Could not analyze resume' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, resumeFileId: result.resumeFileId, analysisRowId: result.analysisRowId })
}
