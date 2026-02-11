'use client'

import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string
  buttonClassName?: string
  revealed?: boolean
  onRevealChange?: (revealed: boolean) => void
}

export default function PressRevealPasswordField({
  wrapperClassName,
  buttonClassName,
  className,
  revealed: revealedProp,
  onRevealChange,
  ...inputProps
}: Props) {
  const [uncontrolledRevealed, setUncontrolledRevealed] = useState(false)
  const revealed = typeof revealedProp === 'boolean' ? revealedProp : uncontrolledRevealed

  function setRevealed(next: boolean) {
    if (typeof revealedProp !== 'boolean') {
      setUncontrolledRevealed(next)
    }
    onRevealChange?.(next)
  }

  function showPassword() {
    setRevealed(true)
  }

  function hidePassword() {
    setRevealed(false)
  }

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <input
        {...inputProps}
        type={revealed ? 'text' : 'password'}
        className={`${className ?? ''} pr-10`}
      />
      <button
        type="button"
        aria-label="Press and hold to view password"
        title="Press and hold to view password"
        className={
          buttonClassName ??
          'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }
        onPointerDown={(event) => {
          event.preventDefault()
          showPassword()
        }}
        onPointerUp={hidePassword}
        onPointerCancel={hidePassword}
        onPointerLeave={hidePassword}
        onBlur={hidePassword}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            showPassword()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            hidePassword()
          }
        }}
      >
        {revealed ? (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m3 3 18 18" />
            <path d="M10.58 10.59A2 2 0 0 0 12 14a2 2 0 0 0 1.41-.58" />
            <path d="M16.68 16.67A10.94 10.94 0 0 1 12 18c-6 0-10-6-10-6a20.9 20.9 0 0 1 5.02-5.78" />
            <path d="M9.88 5.08A10.7 10.7 0 0 1 12 6c6 0 10 6 10 6a21.6 21.6 0 0 1-3.18 4.19" />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
