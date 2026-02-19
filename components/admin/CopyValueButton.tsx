'use client'

import { useState } from 'react'

type Props = {
  value: string
  label?: string
}

export default function CopyValueButton({ value, label = 'Copy' }: Props) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 1400)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : label}
    </button>
  )
}
