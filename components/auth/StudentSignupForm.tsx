'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import TurnstileWidget from '@/components/security/TurnstileWidget'
import OAuthButtons from '@/components/auth/OAuthButtons'
import PressRevealPasswordField from '@/components/forms/PressRevealPasswordField'
import { resolveClientAppOrigin } from '@/lib/url/origin'
import { normalizeSignupEmail } from '@/lib/auth/signup'

const FIELD =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

type Props = {
  queryError: string | null
  requestedNextPath: string | null
}

function getPasswordError(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.'
  return null
}

export default function StudentSignupForm({ queryError, requestedNextPath }: Props) {
  const friendlyCaptchaError = "Please verify you're human and try again."

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revealingPasswords, setRevealingPasswords] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devErrorDetails, setDevErrorDetails] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const roleStep2Path = '/signup/student/details'
  const verifyNextPath = requestedNextPath ?? roleStep2Path

  async function createAccount() {
    setError(null)
    setDevErrorDetails(null)
    setSuccess(null)

    if (!email.trim() || !password) {
      return setError('Email, password, and confirm password are required.')
    }

    const passwordError = getPasswordError(password)
    if (passwordError) return setError(passwordError)
    if (password !== confirmPassword) {
      return setError('Passwords do not match. Re-enter both fields and try again.')
    }
    if (!turnstileToken) return setError(friendlyCaptchaError)

    setLoading(true)

    try {
      const captchaResponse = await fetch('/api/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: turnstileToken,
          action: 'student_signup',
        }),
      })

      if (!captchaResponse.ok) {
        setLoading(false)
        setTurnstileToken('')
        setTurnstileKey((value) => value + 1)
        return setError(friendlyCaptchaError)
      }
    } catch {
      setLoading(false)
      setTurnstileToken('')
      setTurnstileKey((value) => value + 1)
      return setError(friendlyCaptchaError)
    }

    const appOrigin = resolveClientAppOrigin(process.env.NEXT_PUBLIC_APP_URL, window.location.origin)
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeSignupEmail(email),
        password,
        roleHint: 'student',
        nextPath: verifyNextPath,
        authMethod: 'password',
        appOrigin,
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; verifyRequiredPath?: string; error?: string; devDetails?: Record<string, unknown> }
      | null
    if (!response.ok || !payload?.ok || !payload.verifyRequiredPath) {
      setLoading(false)
      setError(payload?.error ?? 'Could not create your account. Please try again.')
      if (process.env.NODE_ENV !== 'production' && payload?.devDetails) {
        setDevErrorDetails(JSON.stringify(payload.devDetails))
      }
      return
    }

    setLoading(false)
    window.location.href = payload.verifyRequiredPath
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          aria-label="Go back"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-opacity hover:opacity-70 focus:outline-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Student signup</h1>
        <p className="mt-2 text-slate-600">Step 1 of 2: create your account, then verify your email.</p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Account</h2>
          <OAuthButtons roleHint="student" nextPath={requestedNextPath ?? undefined} className="mt-4" />
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Or continue with email and password.</p>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                className={FIELD}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <PressRevealPasswordField
                className={FIELD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                revealed={revealingPasswords}
                onRevealChange={setRevealingPasswords}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <PressRevealPasswordField
                className={FIELD}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                revealed={revealingPasswords}
                onRevealChange={setRevealingPasswords}
              />
            </div>
          </div>

          {queryError ? <p className="mt-4 text-sm text-amber-700">{queryError}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          {process.env.NODE_ENV !== 'production' && devErrorDetails ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(devErrorDetails)
                  setSuccess('Error details copied.')
                } catch {
                  setError('Could not copy error details.')
                }
              }}
              className="mt-2 inline-flex rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              Copy error details
            </button>
          ) : null}
          {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

          <TurnstileWidget
            key={turnstileKey}
            action="student_signup"
            className="mt-4"
            appearance="always"
            onTokenChange={setTurnstileToken}
          />

          <button
            onClick={createAccount}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account and verify email'}
          </button>

          <p className="mt-4 text-xs text-slate-500">Step 2 unlocks after email verification.</p>
        </div>
      </div>
    </main>
  )
}
