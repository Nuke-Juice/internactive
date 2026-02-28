'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'cookie_notice_dismissed'

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', onStoreChange)
  window.addEventListener('cookie-notice-change', onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('cookie-notice-change', onStoreChange)
  }
}

function getServerSnapshot() {
  return false
}

function getClientSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'true'
  } catch {
    return true
  }
}

export default function CookieNoticeBanner() {
  const visible = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // Ignore storage failures so the banner can still be dismissed for this view.
    }
    window.dispatchEvent(new Event('cookie-notice-change'))
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <p className="text-sm text-slate-700">We use cookies to keep Internactive running smoothly.</p>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/cookies" className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline">
            Learn more
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
