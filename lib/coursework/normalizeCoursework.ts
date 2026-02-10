import 'server-only'

import { normalizeCatalogLabel, normalizeCatalogToken } from '@/lib/catalog/normalization'
import { supabaseServer } from '@/lib/supabase/server'

export type NormalizeCourseworkResult = {
  courseworkItemIds: string[]
  unknown: string[]
}

export async function normalizeCoursework(input: string[]): Promise<NormalizeCourseworkResult> {
  const cleaned = input.map(normalizeCatalogLabel).filter(Boolean)
  if (cleaned.length === 0) {
    return { courseworkItemIds: [], unknown: [] }
  }

  const tokensByInput = cleaned.map((item) => ({
    original: item,
    normalized: normalizeCatalogToken(item),
  }))
  const normalizedCandidates = Array.from(new Set(tokensByInput.map((item) => item.normalized).filter(Boolean)))

  const supabase = await supabaseServer()
  const { data: rows } = await supabase
    .from('coursework_items')
    .select('id, normalized_name')
    .in('normalized_name', normalizedCandidates)

  const normalizedToId = new Map<string, string>()
  for (const row of rows ?? []) {
    if (typeof row.normalized_name === 'string' && typeof row.id === 'string') {
      normalizedToId.set(row.normalized_name, row.id)
    }
  }

  const courseworkItemIds: string[] = []
  const unknown: string[] = []
  const seenIds = new Set<string>()
  const seenUnknown = new Set<string>()

  for (const item of tokensByInput) {
    const foundId = normalizedToId.get(item.normalized)
    if (foundId) {
      if (!seenIds.has(foundId)) {
        seenIds.add(foundId)
        courseworkItemIds.push(foundId)
      }
      continue
    }

    const unknownKey = item.original.toLowerCase()
    if (!seenUnknown.has(unknownKey)) {
      seenUnknown.add(unknownKey)
      unknown.push(item.original)
    }
  }

  return { courseworkItemIds, unknown }
}
