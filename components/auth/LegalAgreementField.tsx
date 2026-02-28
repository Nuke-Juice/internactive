'use client'

import Link from 'next/link'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  id: string
}

export default function LegalAgreementField({ checked, onChange, id }: Props) {
  return (
    <label htmlFor={id} className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" className="font-medium text-blue-700 hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="font-medium text-blue-700 hover:underline">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  )
}
