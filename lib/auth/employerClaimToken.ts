import { createHash, randomBytes } from 'node:crypto'

export type ClaimTokenRecord = {
  used_at: string | null
  expires_at: string
}

export type ClaimTokenStatus = 'valid' | 'expired' | 'used'

export function generateEmployerClaimToken() {
  return randomBytes(32).toString('base64url')
}

export function hashEmployerClaimToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function claimTokenExpiresAt(from = new Date()) {
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString()
}

export function getClaimTokenStatus(record: ClaimTokenRecord, now = new Date()): ClaimTokenStatus {
  if (record.used_at) return 'used'

  const expiresAt = new Date(record.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return 'expired'
  }

  return 'valid'
}

export function canUseClaimToken(record: ClaimTokenRecord, now = new Date()) {
  return getClaimTokenStatus(record, now) === 'valid'
}
