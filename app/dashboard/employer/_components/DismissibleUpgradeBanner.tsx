'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

type Props = {
  userId: string
}

export default function DismissibleUpgradeBanner({ userId }: Props) {
  const storageKey = useMemo(() => `dismiss_upgrade_best_match:${userId}`, [userId])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(storageKey) === '1')
  }, [storageKey])

  if (dismissed) return null

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <p className="leading-6">
          Best Match ranking and match-reason insights are part of Pro.
          <Link href="/upgrade" className="ml-2 font-semibold underline decoration-amber-700 underline-offset-2">
            View plans
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(storageKey, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss banner"
          className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
