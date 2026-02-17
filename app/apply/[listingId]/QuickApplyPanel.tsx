'use client'

import { useRef, useState } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { useFormStatus } from 'react-dom'

type Props = {
  listingId: string
  action: (formData: FormData) => void | Promise<void>
  hasSavedResume: boolean
  savedResumeFileName?: string | null
  companyName: string
  showNoteField?: boolean
  submitLabel?: string
}

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Submitting…' : label}
    </button>
  )
}

export default function QuickApplyPanel({
  listingId,
  action,
  hasSavedResume,
  savedResumeFileName,
  companyName,
  showNoteField = true,
  submitLabel = 'Submit quick apply',
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const fileInput = form.querySelector<HTMLInputElement>('input[name="resume"]')
    const noteInput = form.querySelector<HTMLTextAreaElement>('textarea[name="quick_apply_note"]')
    const file = fileInput?.files?.[0]
    if (!file && !hasSavedResume) {
      setError('Please upload a PDF resume.')
      event.preventDefault()
      return
    }
    if (file) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) {
        setError('Resume must be a PDF.')
        event.preventDefault()
        return
      }
    }
    if (showNoteField && noteInput && noteInput.value.length > 280) {
      setError('Quick note must be 280 characters or less.')
      event.preventDefault()
      return
    }
    setError(null)
  }
  const isResumeMissing = !hasSavedResume && !selectedFileName

  return (
    <form action={action} onSubmit={validate} className="space-y-5">
      <input type="hidden" name="listing_id" value={listingId} />

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <label className="text-sm font-semibold text-slate-800">Resume (PDF)</label>
        <p className="mt-1 text-xs text-slate-600">We only share your resume with {companyName} for this application.</p>
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files?.[0]
            if (!file) return
            const dataTransfer = new DataTransfer()
            dataTransfer.items.add(file)
            if (fileInputRef.current) {
              fileInputRef.current.files = dataTransfer.files
            }
            setSelectedFileName(file.name)
            setError(null)
          }}
          className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <FileText className="h-4 w-4 text-blue-600" />
              Upload a new resume
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              Choose file
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Drag and drop a PDF here, or click Choose file.</p>
        </div>
        <input
          ref={fileInputRef}
          name="resume"
          type="file"
          accept="application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0]
            setSelectedFileName(file?.name ?? '')
            setError(null)
          }}
          className="sr-only"
        />
        {hasSavedResume ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Using your saved resume {savedResumeFileName ? `(${savedResumeFileName})` : ''}
          </div>
        ) : null}
        {selectedFileName ? (
          <div className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
            {selectedFileName}
          </div>
        ) : null}
      </div>

      {showNoteField ? (
        <div>
          <label className="text-sm font-semibold text-slate-800">Why are you interested? (optional)</label>
          <textarea
            name="quick_apply_note"
            maxLength={280}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            placeholder="Optional 1-2 sentence note"
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {isResumeMissing && !error ? (
        <p className="text-xs text-slate-500">Upload a PDF resume or use a saved resume to apply.</p>
      ) : null}
      <SubmitButton disabled={isResumeMissing} label={submitLabel} />
      <p className="text-center text-xs text-slate-500">Takes less than a minute.</p>
    </form>
  )
}
