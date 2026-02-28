'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { StudentResumeProfile } from '@/lib/student/profileResume'

const MAX_RESUME_BYTES = 5 * 1024 * 1024

type Props = {
  userId: string
  initialResume: StudentResumeProfile
}

function formatUploadedAt(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildStoragePath(userId: string, filename: string) {
  const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, '-')
  return `resumes/${userId}/profile/resume-${Date.now()}-${sanitizedFileName}`
}

export default function StudentResumeManager({ userId, initialResume }: Props) {
  const router = useRouter()
  const [resume, setResume] = useState(initialResume)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasResume = Boolean(resume.resumePath)
  const uploadedLabel = formatUploadedAt(resume.resumeUploadedAt)

  async function handleFileChange(file: File | null) {
    if (!file) return

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Resume must be a PDF.')
      return
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError('Resume must be 5MB or smaller.')
      return
    }

    setSelectedFileName(file.name)
    setError(null)
    setSuccess(null)

    const supabase = supabaseBrowser()
    const storagePath = buildStoragePath(userId, file.name)

    startTransition(() => {
      void (async () => {
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(storagePath, file, { contentType: 'application/pdf', upsert: true })

        if (uploadError) {
          setError(uploadError.message)
          return
        }

        const uploadedAt = new Date().toISOString()
        const { error: authError } = await supabase.auth.updateUser({
          data: {
            resume_path: storagePath,
            resume_file_name: file.name,
            resume_uploaded_at: uploadedAt,
          },
        })

        if (authError) {
          setError(authError.message)
          return
        }

        setResume({
          resumePath: storagePath,
          resumeFileName: file.name,
          resumeUploadedAt: uploadedAt,
        })

        const analysisResponse = await fetch('/api/student/resume/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storagePath,
            originalFilename: file.name,
            mimeType: file.type || 'application/pdf',
            fileSize: file.size,
          }),
        })

        if (!analysisResponse.ok) {
          const payload = (await analysisResponse.json().catch(() => null)) as { error?: string } | null
          setSelectedFileName(null)
          setError(payload?.error ?? 'Resume uploaded but analysis could not start.')
          setSuccess(hasResume ? 'Resume replaced.' : 'Resume uploaded.')
          router.refresh()
          return
        }

        setSelectedFileName(null)
        setSuccess(hasResume ? 'Resume replaced.' : 'Resume uploaded.')
        router.refresh()
      })()
    })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{hasResume ? 'Uploaded' : 'Not uploaded'}</p>
          {!hasResume ? <p className="mt-2 text-sm text-slate-600">Upload once to apply faster.</p> : null}
        </div>
        {hasResume ? (
          <Link
            href="/student/resume/download"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View current resume
          </Link>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-medium text-slate-900">{resume.resumeFileName ?? selectedFileName ?? 'No resume on file'}</div>
        <div className="mt-1 text-xs text-slate-600">
          {uploadedLabel ? `Uploaded ${uploadedLabel}` : hasResume ? 'Uploaded date unavailable' : 'PDF only, max 5MB'}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="mt-6">
        <label className="text-sm font-medium text-slate-700">{hasResume ? 'Replace resume (PDF)' : 'Upload resume (PDF)'}</label>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={isPending}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:opacity-60"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            void handleFileChange(file)
            event.currentTarget.value = ''
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          {isPending ? 'Uploading resume...' : hasResume ? 'Upload a new PDF to replace the saved resume used for future applications.' : 'Your saved resume will auto-fill future applications.'}
        </p>
      </div>
    </section>
  )
}
