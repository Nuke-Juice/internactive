import 'server-only'

import { normalizeCatalogLabel, normalizeCatalogToken, slugifyCatalogLabel } from '@/lib/catalog/normalization'
import { supabaseServer } from '@/lib/supabase/server'

export type NormalizeSkillsResult = {
  skillIds: string[]
  unknown: string[]
}

export const normalizeSkillLabel = normalizeCatalogLabel
export const normalizeSkillToken = normalizeCatalogToken
export const slugifySkillLabel = slugifyCatalogLabel

export async function normalizeSkills(input: string[]): Promise<NormalizeSkillsResult> {
  const cleaned = input.map(normalizeSkillLabel).filter(Boolean)
  if (cleaned.length === 0) {
    return { skillIds: [], unknown: [] }
  }

  const tokensByInput = cleaned.map((item) => {
    const slug = slugifySkillLabel(item)
    const compactToken = normalizeSkillToken(item)
    const rawToken = item.toLowerCase()
    return {
      original: item,
      candidates: [slug, compactToken, rawToken].filter(Boolean),
      slug,
    }
  })

  const aliasCandidates = Array.from(new Set(tokensByInput.flatMap((item) => item.candidates)))
  const slugCandidates = Array.from(new Set(tokensByInput.map((item) => item.slug).filter(Boolean)))

  const supabase = await supabaseServer()

  const [{ data: aliasRows }, { data: skillRows }] = await Promise.all([
    supabase.from('skill_aliases').select('alias, skill_id').in('alias', aliasCandidates),
    supabase.from('skills').select('id, slug').in('slug', slugCandidates),
  ])

  const aliasToSkillId = new Map<string, string>()
  for (const row of aliasRows ?? []) {
    if (typeof row.alias === 'string' && typeof row.skill_id === 'string') {
      aliasToSkillId.set(row.alias, row.skill_id)
    }
  }

  const slugToSkillId = new Map<string, string>()
  for (const row of skillRows ?? []) {
    if (typeof row.slug === 'string' && typeof row.id === 'string') {
      slugToSkillId.set(row.slug, row.id)
    }
  }

  const skillIds: string[] = []
  const unknown: string[] = []
  const seenSkillIds = new Set<string>()
  const seenUnknown = new Set<string>()

  for (const item of tokensByInput) {
    let skillId = ''

    for (const candidate of item.candidates) {
      const fromAlias = aliasToSkillId.get(candidate)
      if (fromAlias) {
        skillId = fromAlias
        break
      }
    }

    if (!skillId && item.slug) {
      const fromSlug = slugToSkillId.get(item.slug)
      if (fromSlug) skillId = fromSlug
    }

    if (skillId) {
      if (!seenSkillIds.has(skillId)) {
        seenSkillIds.add(skillId)
        skillIds.push(skillId)
      }
      continue
    }

    const unknownKey = item.original.toLowerCase()
    if (!seenUnknown.has(unknownKey)) {
      seenUnknown.add(unknownKey)
      unknown.push(item.original)
    }
  }

  return { skillIds, unknown }
}
