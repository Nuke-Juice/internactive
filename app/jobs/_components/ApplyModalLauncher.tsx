'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import {
  submitApplicationFromListingModalAction,
  type ApplyFromListingModalState,
} from './applyActions'

type ModalView = 'form' | 'success' | 'error'

type Props = {
  listingId: string
  listingTitle: string
  companyName: string
  isAuthenticated: boolean
  userRole?: 'student' | 'employer' | null
  isClosed?: boolean
  screeningQuestion?: string | null
  hasSavedResume?: boolean
  savedResumeFileName?: string | null
  profileWarning?: string | null
}

type ModalContentProps = Pick<
  Props,
  'listingId' | 'listingTitle' | 'companyName' | 'screeningQuestion' | 'hasSavedResume' | 'savedResumeFileName'
> & {
  profileWarning?: string | null
  onClose: () => void
  onReset: () => void
}

const initialState: ApplyFromListingModalState = { ok: false }

function SuccessIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  )
}

function ErrorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  )
}

function SpinnerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" className="opacity-25" stroke="currentColor" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" className="opacity-90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? 'Submitting application' : 'Submit application'}
      className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? (
        <>
          <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        'Submit application'
      )}
    </button>
  )
}

function ApplyModalContent({
  listingId,
  listingTitle,
  companyName,
  screeningQuestion = null,
  hasSavedResume = false,
  savedResumeFileName = null,
  profileWarning = null,
  onClose,
  onReset,
}: ModalContentProps) {
  const router = useRouter()
  const [state, formAction] = useActionState(submitApplicationFromListingModalAction, initialState)
  const screeningPrompt = useMemo(() => (screeningQuestion ?? '').trim(), [screeningQuestion])
  const successTitleRef = useRef<HTMLHeadingElement | null>(null)
  const errorTitleRef = useRef<HTMLHeadingElement | null>(null)
  const employerName = companyName || 'Eggertsen Inc.'
  const view: ModalView = state.ok ? 'success' : state.error ? 'error' : 'form'
  const showAtsNote = state.externalApplyRequired === true
  const submittedAt = useMemo(() => (state.ok ? new Date().toLocaleString() : null), [state.ok])

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [router, state.ok])

  useEffect(() => {
    if (view === 'success') successTitleRef.current?.focus()
    if (view === 'error') errorTitleRef.current?.focus()
  }, [view])

  if (view === 'success') {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-3">
          <SuccessIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <h3 ref={successTitleRef} tabIndex={-1} className="text-lg font-semibold text-slate-900 outline-none">
              Application submitted
            </h3>
            <p className="mt-1 text-sm text-slate-600">Your application has been sent to {employerName}.</p>
          </div>
        </div>

        {showAtsNote ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              If the employer uses an ATS, they may email you a link to complete an additional application.
            </p>
          </div>
        ) : null}

        {state.warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {state.warning}
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted</dt>
            <dd className="mt-1 text-sm text-slate-900">{submittedAt ?? 'Just now'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Employer</dt>
            <dd className="mt-1 text-sm text-slate-900">{employerName}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Listing</dt>
            <dd className="mt-1 text-sm text-slate-900">{listingTitle}</dd>
          </div>
        </dl>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href="/applications"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label="View your applications"
          >
            View application
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            aria-label="Done and close application confirmation"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-3">
          <ErrorIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <h3 ref={errorTitleRef} tabIndex={-1} className="text-lg font-semibold text-slate-900 outline-none">
              Application could not be submitted
            </h3>
            <p className="mt-1 text-sm text-slate-600">{state.error || 'Something went wrong while submitting your application.'}</p>
          </div>
        </div>

        {(state.profile_missing?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Complete your profile before retrying this application.
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {(state.profile_missing?.length ?? 0) > 0 ? (
            <Link
              href="/account"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              aria-label="Go to your profile"
            >
              Go to profile
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            aria-label="Retry application submission"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="listing_id" value={listingId} />

      {profileWarning ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {profileWarning}
        </div>
      ) : null}

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
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Cancel application"
        >
          Cancel
        </button>
        <div className="flex-1">
          <SubmitButton />
        </div>
      </div>
    </form>
  )
}

export default function ApplyModalLauncher({
  listingId,
  listingTitle,
  companyName,
  isAuthenticated,
  userRole = null,
  isClosed = false,
  screeningQuestion = null,
  hasSavedResume = false,
  savedResumeFileName = null,
  profileWarning = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shouldAutoOpen = searchParams.get('apply') === '1' && isAuthenticated && userRole === 'student' && !isClosed
  const [open, setOpen] = useState(shouldAutoOpen)
  const [modalInstanceKey, setModalInstanceKey] = useState(0)

  function handleClose() {
    setOpen(false)
    setModalInstanceKey((prev) => prev + 1)
  }

  function handleReset() {
    setModalInstanceKey((prev) => prev + 1)
  }

  useEffect(() => {
    if (shouldAutoOpen) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('apply')
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [pathname, router, searchParams, shouldAutoOpen])

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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-modal-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="apply-modal-title" className="text-lg font-semibold text-slate-900">
                  Apply to {companyName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Quick apply with your profile and resume.</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close apply modal"
              >
                ×
              </button>
            </div>

            <ApplyModalContent
              key={modalInstanceKey}
              listingId={listingId}
              listingTitle={listingTitle}
              companyName={companyName}
              screeningQuestion={screeningQuestion}
              hasSavedResume={hasSavedResume}
              savedResumeFileName={savedResumeFileName}
              profileWarning={profileWarning}
              onClose={handleClose}
              onReset={handleReset}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
