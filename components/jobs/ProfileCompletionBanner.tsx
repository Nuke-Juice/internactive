'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

type Props = {
  userId: string
  completionPercent: number
  missingFieldLabels: string[]
}

export default function ProfileCompletionBanner({ userId, completionPercent, missingFieldLabels }: Props) {
  const dismissalSignature = useMemo(
    () => `${completionPercent}:${missingFieldLabels.join('|')}`,
    [completionPercent, missingFieldLabels]
  )
  const storageKey = useMemo(
    () => `dismiss_profile_completion_banner:${userId}:${dismissalSignature}`,
    [dismissalSignature, userId]
  )
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(storageKey) === '1'
  })

  if (dismissed) return null

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <div className="flex items-start justify-between gap-3">
        <div className="leading-6">
          <p className="font-semibold">Profile {completionPercent}% Complete</p>
          <p className="mt-0.5 text-blue-800">
            {missingFieldLabels.length > 0 ? `Next: add ${missingFieldLabels[0]}. ` : ''}
            <Link href="/signup/student/details" className="font-semibold underline underline-offset-2">
              Finish profile
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(storageKey, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss profile completion banner"
          className="rounded-md p-1 text-blue-700 hover:bg-blue-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
