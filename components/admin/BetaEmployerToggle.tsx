'use client'

import { useState } from 'react'

type BetaEmployerToggleProps = {
  employerId: string
  initialIsBetaEmployer: boolean
}

export default function BetaEmployerToggle({ employerId, initialIsBetaEmployer }: BetaEmployerToggleProps) {
  const [isBetaEmployer, setIsBetaEmployer] = useState(initialIsBetaEmployer)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onToggle() {
    if (isSaving) return
    const nextValue = !isBetaEmployer

    if (nextValue) {
      const confirmed = window.confirm('Beta bypass allows unlimited listings without payment. Enable Beta Employer?')
      if (!confirmed) return
    }

    const previousValue = isBetaEmployer
    setError(null)
    setIsBetaEmployer(nextValue)
    setIsSaving(true)

    try {
      const response = await fetch('/api/admin/employers/beta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employer_id: employerId,
          is_beta_employer: nextValue,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || 'Unable to update beta status.')
      }

      const payload = (await response.json()) as { is_beta_employer?: boolean }
      setIsBetaEmployer(Boolean(payload.is_beta_employer))
    } catch (requestError) {
      setIsBetaEmployer(previousValue)
      setError(requestError instanceof Error ? requestError.message : 'Unable to update beta status.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isBetaEmployer}
          aria-label="Toggle beta employer"
          disabled={isSaving}
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
            isBetaEmployer ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-slate-200'
          } ${isSaving ? 'cursor-not-allowed opacity-70' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              isBetaEmployer ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs font-medium text-slate-700">Beta: {isBetaEmployer ? 'On' : 'Off'}</span>
      </div>
      {error ? <div className="text-[11px] text-red-700">{error}</div> : null}
    </div>
  )
}
