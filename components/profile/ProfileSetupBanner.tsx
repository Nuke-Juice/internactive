'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ProfileSetupBannerProps = {
  completionPercent: number
  missingItems: string[]
  userId?: string
  title?: string
  subtitle?: string
}

export default function ProfileSetupBanner({
  completionPercent,
  missingItems,
  userId,
  title,
  subtitle,
}: ProfileSetupBannerProps) {
  const storageKey = useMemo(
    () => `internup:profile-setup-banner:dismissed-until:${userId ?? 'student'}`,
    [userId]
  )
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const dismissedUntil = Number(raw)
      if (Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil) {
        setIsDismissed(true)
      }
    } catch {
      // Ignore localStorage failures and show banner.
    }
  }, [storageKey])

  const defaultTitle = `Profile ${completionPercent}% complete`
  const firstMissing = missingItems[0]
  const defaultSubtitle = firstMissing
    ? `Add ${firstMissing.toLowerCase()} to improve ranking.`
    : 'Add more details to improve ranking.'

  if (isDismissed) {
    return (
      <div className="mb-3 mt-2 flex justify-end">
        <Link
          href="/account"
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Profile incomplete
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-3 mt-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title ?? defaultTitle}</p>
          <p className="truncate text-xs text-blue-800">{subtitle ?? defaultSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="inline-flex h-8 items-center rounded-md border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            Complete profile
          </Link>
          <button
            type="button"
            aria-label="Dismiss profile reminder"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-sm text-blue-700 hover:bg-blue-50"
            onClick={() => {
              const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000
              try {
                window.localStorage.setItem(storageKey, String(dismissedUntil))
              } catch {
                // Ignore localStorage failures and still dismiss for this render.
              }
              setIsDismissed(true)
            }}
          >
            x
          </button>
        </div>
      </div>
    </div>
  )
}
