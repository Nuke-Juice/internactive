'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type CoverageSignal = {
  key: string
  label: string
  present: boolean
}

type Props = {
  met: number
  total: number
  signals: CoverageSignal[]
  requiredCount: number
  preferredCount: number
  verifiedLinks: number
  courseworkCategoryLinks: number
  reviewHref: string
}

export default function CoverageBadgePopover(props: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const complete = props.met === props.total

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const focusables = panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables?.[0]
    const last = focusables?.[focusables.length - 1]
    first?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          complete ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'
        }`}
        title={`Coverage = ${props.met}/${props.total}. Click for breakdown.`}
      >
        Coverage {props.met}/{props.total}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <>
          <button type="button" aria-label="Close coverage details" className="fixed inset-0 z-[60] bg-slate-900/40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-1/2 z-[70] max-h-[80vh] -translate-y-1/2 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-[11px] shadow-xl sm:left-1/2 sm:max-w-sm sm:-translate-x-1/2"
          >
            <div className="mb-1 text-xs font-semibold text-slate-800">Signals present: {props.met}/{props.total}</div>
            <div className="space-y-1 text-slate-600">
              {props.signals.map((signal) => (
                <div key={signal.key} className="flex items-center justify-between gap-2">
                  <span>{signal.label}</span>
                  <span className={signal.present ? 'text-emerald-700' : 'text-amber-700'}>{signal.present ? 'present' : 'missing'}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2 text-slate-600">
              Skills: {props.requiredCount} req, {props.preferredCount} pref, {props.verifiedLinks} verified
            </div>
            <div className="text-slate-600">Coursework categories: {props.courseworkCategoryLinks}</div>
            <div className="mt-2 flex items-center justify-between">
              <Link href={`${props.reviewHref}#match-quality`} className="text-blue-700 hover:underline" onClick={() => setOpen(false)}>
                Open full review and fixes
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </>
  )
}
