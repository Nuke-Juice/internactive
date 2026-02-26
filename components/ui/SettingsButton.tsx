'use client'

import type { ButtonHTMLAttributes } from 'react'
import { Cog } from 'lucide-react'

type Props = ButtonHTMLAttributes<HTMLButtonElement>

export default function SettingsButton({ className, children, ...props }: Props) {
  return (
    <button {...props} className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      <Cog className="h-4 w-4" />
      {children ?? 'Settings'}
    </button>
  )
}
