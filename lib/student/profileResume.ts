import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { hasSupabaseAdminCredentials, supabaseAdmin } from '@/lib/supabase/admin'

export type StudentResumeProfile = {
  resumePath: string | null
  resumeFileName: string | null
  resumeUploadedAt: string | null
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function inferFileNameFromPath(storagePath: string | null) {
  if (!storagePath) return null
  const normalized = storagePath.split('/').filter(Boolean)
  const candidate = normalized.at(-1) ?? ''
  return candidate.trim().length > 0 ? candidate.trim() : null
}

export function getStudentResumeProfile(metadata: Record<string, unknown> | null | undefined): StudentResumeProfile {
  const resumePath = asTrimmedString(metadata?.resume_path)
  const resumeFileName = asTrimmedString(metadata?.resume_file_name) ?? inferFileNameFromPath(resumePath)
  const resumeUploadedAt = asTrimmedString(metadata?.resume_uploaded_at)

  return {
    resumePath,
    resumeFileName,
    resumeUploadedAt,
  }
}

export function hasStudentResume(profile: StudentResumeProfile) {
  return Boolean(profile.resumePath)
}

async function lookupResumeUploadTimestamp(params: {
  supabase: SupabaseClient
  userId: string
  resumePath: string
}) {
  const { data } = await params.supabase
    .from('applications')
    .select('created_at')
    .eq('student_id', params.userId)
    .eq('resume_url', params.resumePath)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at?: string | null }>()

  return asTrimmedString(data?.created_at)
}

export async function syncStudentResumeFromApplications(params: {
  supabase: SupabaseClient
  userId: string
  currentMetadata?: Record<string, unknown> | null
  preferredResumePath?: string | null
  preferredResumeFileName?: string | null
  preferredResumeUploadedAt?: string | null
}) {
  const current = getStudentResumeProfile(params.currentMetadata)

  let nextPath = current.resumePath ?? asTrimmedString(params.preferredResumePath)
  let nextFileName = current.resumeFileName ?? asTrimmedString(params.preferredResumeFileName)
  let nextUploadedAt = current.resumeUploadedAt ?? asTrimmedString(params.preferredResumeUploadedAt)

  if (!nextPath) {
    const { data: latestApplication } = await params.supabase
      .from('applications')
      .select('resume_url, created_at')
      .eq('student_id', params.userId)
      .not('resume_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ resume_url?: string | null; created_at?: string | null }>()

    nextPath = asTrimmedString(latestApplication?.resume_url)
    nextUploadedAt = nextUploadedAt ?? asTrimmedString(latestApplication?.created_at)
  } else if (!nextUploadedAt) {
    nextUploadedAt = await lookupResumeUploadTimestamp({
      supabase: params.supabase,
      userId: params.userId,
      resumePath: nextPath,
    })
  }

  nextFileName = nextFileName ?? inferFileNameFromPath(nextPath)

  const changed =
    nextPath !== current.resumePath ||
    nextFileName !== current.resumeFileName ||
    nextUploadedAt !== current.resumeUploadedAt

  const nextProfile: StudentResumeProfile = {
    resumePath: nextPath,
    resumeFileName: nextFileName,
    resumeUploadedAt: nextUploadedAt,
  }

  if (!changed || !nextPath || !hasSupabaseAdminCredentials()) {
    return {
      synced: false,
      profile: nextProfile,
    }
  }

  const admin = supabaseAdmin()
  const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(params.userId)
  if (authUserError || !authUserResult.user) {
    return {
      synced: false,
      profile: nextProfile,
    }
  }

  const userMetadata = (authUserResult.user.user_metadata ?? {}) as Record<string, unknown>
  const { error: updateError } = await admin.auth.admin.updateUserById(params.userId, {
    user_metadata: {
      ...userMetadata,
      resume_path: nextProfile.resumePath,
      resume_file_name: nextProfile.resumeFileName,
      resume_uploaded_at: nextProfile.resumeUploadedAt,
    },
  })

  return {
    synced: !updateError,
    profile: nextProfile,
  }
}
