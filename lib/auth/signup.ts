type SupabaseAuthErrorLike = {
  message?: string | null
  code?: string | null
  status?: number | null
  name?: string | null
}

export type SignupErrorKey =
  | 'INVALID_EMAIL'
  | 'USER_EXISTS'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'DOMAIN_NOT_ALLOWED'
  | 'UNKNOWN'

export type SignupErrorInfo = {
  key: SignupErrorKey
  publicMessage: string
  statusCode: number
}

export type InterpretedSignupResult =
  | { ok: true }
  | { ok: false; errorKey: string; message: string; statusCode: number }

export function normalizeSignupEmail(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const at = trimmed.lastIndexOf('@')
  if (at < 1 || at === trimmed.length - 1) return trimmed
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1).trim().toLowerCase()
  return `${local}@${domain}`
}

export function extractEmailDomain(value: string) {
  const normalized = normalizeSignupEmail(value)
  const at = normalized.lastIndexOf('@')
  if (at < 1 || at === normalized.length - 1) return null
  return normalized.slice(at + 1)
}

export function isValidEmailFormat(value: string) {
  const normalized = normalizeSignupEmail(value)
  // Keep validation intentionally permissive and rely on Supabase for canonical validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalized)
}

export function mapSignupError(error: unknown): SignupErrorInfo {
  const raw = (error ?? {}) as SupabaseAuthErrorLike
  const message = String(raw.message ?? '').toLowerCase()
  const code = String(raw.code ?? '').toLowerCase()
  const name = String(raw.name ?? '').toLowerCase()
  const status = typeof raw.status === 'number' ? raw.status : null

  if (message.includes('already registered') || message.includes('user already exists') || code === 'user_already_exists') {
    return {
      key: 'USER_EXISTS',
      publicMessage: 'Account already exists. Try logging in.',
      statusCode: 409,
    }
  }

  if (message.includes('rate limit') || status === 429) {
    return {
      key: 'RATE_LIMIT',
      publicMessage: 'Too many signup attempts. Please wait a moment and try again.',
      statusCode: 429,
    }
  }

  if (
    message.includes('invalid email') ||
    code === 'validation_failed' ||
    message.includes('email address') ||
    message.includes('unable to validate email address')
  ) {
    return {
      key: 'INVALID_EMAIL',
      publicMessage: 'Enter a valid email address and try again.',
      statusCode: 400,
    }
  }

  if (
    name.includes('authretryablefetcherror') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('enotfound') ||
    status === 0
  ) {
    return {
      key: 'NETWORK',
      publicMessage: 'Network issue while creating account. Please try again.',
      statusCode: 502,
    }
  }

  return {
    key: 'UNKNOWN',
    publicMessage: 'Could not create your account. Please try again.',
    statusCode: 400,
  }
}

export function interpretSignupResult(input: {
  error: unknown | null
  userId: string | null
}): InterpretedSignupResult {
  if (input.error) {
    const mapped = mapSignupError(input.error)
    return {
      ok: false,
      errorKey: mapped.key,
      message: mapped.publicMessage,
      statusCode: mapped.statusCode,
    }
  }

  if (!input.userId) {
    return {
      ok: false,
      errorKey: 'PROFILE_SETUP',
      message: 'Signup succeeded but profile setup failed. Click to retry.',
      statusCode: 500,
    }
  }

  return { ok: true }
}
