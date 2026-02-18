export function isResumeStoragePathOwnedByUser(userId: string, storagePath: string) {
  const normalizedUserId = userId.trim()
  const normalizedPath = storagePath.trim().replace(/^\/+/, '')
  if (!normalizedUserId || !normalizedPath) return false

  const ownedPrefix = `resumes/${normalizedUserId}/`
  return normalizedPath.startsWith(ownedPrefix)
}
