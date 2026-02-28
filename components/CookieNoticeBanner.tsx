'use client'

import Link from 'next/link'
import { useState } from 'react'

const STORAGE_KEY = 'cookie_notice_dismissed'

export default function CookieNoticeBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  })

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Ignore storage failures so the banner can still be dismissed for this view.
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-slate-700">
          We use cookies and local storage to operate the site and understand usage. See our{' '}
          <Link href="/cookies" className="font-medium text-blue-700 hover:underline">
            Cookie Notice
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-medium text-blue-700 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/cookies"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Learn more
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
