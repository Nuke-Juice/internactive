'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

type Props = {
  userId: string
  employerDefaultsConfigured: boolean
  employerDefaultAtsHost?: string | null
}

export default function DismissibleAtsSetupBanner({
  userId,
  employerDefaultsConfigured,
  employerDefaultAtsHost,
}: Props) {
  const storageKey = useMemo(() => {
    const mode = employerDefaultsConfigured ? 'configured' : 'setup'
    return `dismiss_ats_defaults_banner:${userId}:${mode}`
  }, [employerDefaultsConfigured, userId])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(storageKey) === '1')
  }, [storageKey])

  if (dismissed) return null

  const boxClass = employerDefaultsConfigured
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-300 bg-amber-50 text-amber-900'

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${boxClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {employerDefaultsConfigured
              ? `ATS configured${employerDefaultAtsHost ? `: ${employerDefaultAtsHost}` : ''}`
              : 'Set up ATS defaults'}
          </div>
          <div className="mt-1 text-xs">
            {employerDefaultsConfigured
              ? 'Listings can inherit these defaults automatically. Override per listing only when needed.'
              : 'Configure ATS once and inherit it across listings.'}
          </div>
          <Link href="/dashboard/employer/settings" className="mt-2 inline-flex rounded-md border border-current/25 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-white/80">
            {employerDefaultsConfigured ? 'Edit ATS defaults' : 'Set up ATS'}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(storageKey, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss ATS setup banner"
          className="rounded-md p-1 text-current/80 hover:bg-white/60"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
