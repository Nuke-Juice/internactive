'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/feedback/ToastProvider'

function decode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isIgnorableValue(value: string | null) {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return normalized.length === 0 || normalized === 'null' || normalized === 'undefined'
}

export default function RouteFeedbackToasts() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const handledRef = useRef<string>('')

  useEffect(() => {
    const raw = searchParams.toString()
    const key = `${pathname}?${raw}`
    if (!raw || handledRef.current === key) return

    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const warning = searchParams.get('warning')
    const verified = searchParams.get('verified')
    const toast = searchParams.get('toast')
    const toastType = searchParams.get('toast_type')
    const publishedId = searchParams.get('published_id')

    if (verified === '1') {
      showToast({ kind: 'success', message: 'Email verified ✓', key: 'verified-1' })
    }
    if (!isIgnorableValue(success) && success && !isIgnorableValue(publishedId) && publishedId) {
      const message = success === '1' ? 'Saved successfully.' : decode(success)
      const encodedListingId = encodeURIComponent(publishedId)
      showToast({
        kind: 'success',
        message,
        key: `success:${success}:published:${publishedId}`,
        actionLabel: 'View listing',
        onAction: () => {
          router.push(`/jobs/${encodedListingId}`)
        },
      })
    } else if (!isIgnorableValue(success) && success) {
      const message = success === '1' ? 'Saved successfully.' : decode(success)
      showToast({ kind: 'success', message, key: `success:${success}` })
    }
    if (!isIgnorableValue(warning) && warning) {
      showToast({ kind: 'warning', message: decode(warning), key: `warning:${warning}` })
    }
    if (!isIgnorableValue(error) && error) {
      showToast({ kind: 'error', message: decode(error), key: `error:${error}` })
    }
    if (!isIgnorableValue(toast) && toast) {
      const kind = toastType === 'warning' || toastType === 'error' || toastType === 'success' ? toastType : 'success'
      showToast({ kind, message: decode(toast), key: `toast:${kind}:${toast}` })
    }

    if (process.env.NODE_ENV !== 'production' && (verified || success || warning || error || toast)) {
      console.debug('[RouteFeedbackToasts] fired', { pathname, verified, success, warning, error, toast, toastType, publishedId })
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    ;['success', 'error', 'warning', 'verified', 'toast', 'toast_type', 'published_id'].forEach((param) => nextParams.delete(param))
    const next = nextParams.toString()
    handledRef.current = key
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [pathname, router, searchParams, showToast])

  return null
}
