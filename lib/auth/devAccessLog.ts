type AccessDecision = 'granted' | 'denied'

type AccessLogInput = {
  requestedPath: string
  authUserId: string | null
  role: string | null
  decision: AccessDecision
}

const isDev = process.env.NODE_ENV !== 'production'

export function logAccessDecision(input: AccessLogInput) {
  if (!isDev) return
  console.debug('[RBAC]', input)
}

export function logRoleLookupWarning(input: {
  requestedPath: string
  authUserId: string | null
  warning: string
}) {
  if (!isDev) return
  console.warn('[RBAC][role_lookup_failed]', input)
}
