export function maskEmail(value: string | null | undefined) {
  const email = (value ?? '').trim().toLowerCase()
  const atIndex = email.indexOf('@')
  if (!email || atIndex <= 0 || atIndex === email.length - 1) return email

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (local.length <= 2) {
    return `${local[0] ?? '*'}***@${domain}`
  }

  if (local.length <= 5) {
    return `${local.slice(0, 2)}***@${domain}`
  }

  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`
}
