export type NormalizeCourseworkResult = {
  courseworkItemIds: string[]
  unknown: string[]
}

export async function normalizeCourseworkClient(coursework: string[]): Promise<NormalizeCourseworkResult> {
  const response = await fetch('/api/coursework/normalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coursework }),
  })

  if (!response.ok) {
    throw new Error('Failed to normalize coursework.')
  }

  const data = (await response.json()) as NormalizeCourseworkResult
  return {
    courseworkItemIds: Array.isArray(data.courseworkItemIds)
      ? data.courseworkItemIds.filter((item): item is string => typeof item === 'string')
      : [],
    unknown: Array.isArray(data.unknown) ? data.unknown.filter((item): item is string => typeof item === 'string') : [],
  }
}
