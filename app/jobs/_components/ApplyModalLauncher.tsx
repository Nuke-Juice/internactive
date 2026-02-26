'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { useToast } from '@/components/feedback/ToastProvider'
import {
  submitApplicationFromListingModalAction,
  type ApplyFromListingModalState,
} from './applyActions'

type Props = {
  listingId: string
  companyName: string
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  isClosed?: boolean
  screeningQuestion?: string | null
  hasSavedResume?: boolean
  savedResumeFileName?: string | null
}

const initialState: ApplyFromListingModalState = { ok: false }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? 'Submitting...' : 'Submit application'}
    </button>
  )
}

export default function ApplyModalLauncher({
  listingId,
  companyName,
  isAuthenticated,
  userRole = null,
  isClosed = false,
  screeningQuestion = null,
  hasSavedResume = false,
  savedResumeFileName = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(submitApplicationFromListingModalAction, initialState)
  const screeningPrompt = useMemo(() => (screeningQuestion ?? '').trim(), [screeningQuestion])

  useEffect(() => {
    if (searchParams.get('apply') === '1' && isAuthenticated && userRole === 'student' && !isClosed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('apply')
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [isAuthenticated, isClosed, pathname, router, searchParams, userRole])

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      showToast({ kind: 'success', message: state.successMessage || 'Application submitted successfully.' })
      if (state.externalApplyRequired && state.externalApplyUrl) {
        showToast({
          kind: 'warning',
          message: 'Finish your employer application in a new tab.',
          actionLabel: 'Open employer form',
          onAction: () => {
            window.open(state.externalApplyUrl ?? '', '_blank', 'noopener,noreferrer')
          },
        })
      }
      router.refresh()
      return
    }
    if (state.error) {
      if ((state.profile_missing?.length ?? 0) > 0) {
        showToast({
          kind: 'error',
          message: state.error,
          actionLabel: 'Go to Profile',
          onAction: () => {
            router.push('/account')
          },
        })
        return
      }
      showToast({ kind: 'error', message: state.error })
    }
  }, [router, showToast, state])

  if (isClosed) {
    return (
      <button type="button" disabled className="inline-flex w-full items-center justify-center rounded-xl bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
        Closed
      </button>
    )
  }

  if (userRole === 'employer') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-600"
      >
        Switch to student account to apply
      </button>
    )
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={`/signup/student?next=${encodeURIComponent(`/jobs/${listingId}?apply=1`)}`}
        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Apply
      </Link>
    )
  }

  if (userRole !== 'student') {
    return (
      <Link
        href="/account"
        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Choose account type to apply
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
      >
        Apply
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Apply to {companyName}</h3>
                <p className="mt-1 text-sm text-slate-600">Quick apply with your profile and resume.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form action={formAction} className="mt-4 space-y-4">
              <input type="hidden" name="listing_id" value={listingId} />

              {screeningPrompt ? (
                <div>
                  <label className="text-sm font-medium text-slate-800">{screeningPrompt}</label>
                  <textarea
                    name="screening_response"
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="Type your response"
                  />
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Resume</p>
                {hasSavedResume ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Using saved resume{savedResumeFileName ? `: ${savedResumeFileName}` : ''}. Upload a new file only if you want to replace it for this application.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">Upload a PDF resume to submit your application.</p>
                )}
                <input
                  type="file"
                  name="resume"
                  accept="application/pdf,.pdf"
                  required={!hasSavedResume}
                  className="mt-2 block w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <div className="flex-1">
                  <SubmitButton />
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
