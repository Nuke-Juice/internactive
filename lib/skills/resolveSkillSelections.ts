import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeCatalogLabel, normalizeCatalogToken, slugifyCatalogLabel } from '@/lib/catalog/normalization'

type SupabaseLike = SupabaseClient

export type ResolvedSkillSelections = {
  canonicalSkillIds: string[]
  customSkillIds: string[]
  canonicalLabels: string[]
  customLabels: string[]
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeSkillInputLabels(labels: string[]) {
  return unique(labels.map((label) => normalizeCatalogLabel(label))).filter(Boolean)
}

function skillLookupTokens(label: string) {
  const normalizedLabel = normalizeCatalogLabel(label)
  const slug = slugifyCatalogLabel(normalizedLabel)
  const compact = normalizeCatalogToken(normalizedLabel)
  const rawLower = normalizedLabel.toLowerCase()
  return unique([slug, compact, rawLower])
}

export async function resolveSkillSelections(params: {
  supabase: SupabaseLike
  ownerType: 'student' | 'employer'
  ownerId: string
  canonicalSkillIds: string[]
  rawLabels: string[]
}): Promise<ResolvedSkillSelections> {
  const canonicalSkillIds = unique(params.canonicalSkillIds)
  const cleanedLabels = normalizeSkillInputLabels(params.rawLabels)

  const { data: canonicalRows } = canonicalSkillIds.length
    ? await params.supabase
        .from('skills')
        .select('id, label')
        .in('id', canonicalSkillIds)
    : { data: [] as Array<Record<string, unknown>> }

  const canonicalById = new Map<string, string>()
  for (const row of canonicalRows ?? []) {
    const id = typeof row.id === 'string' ? row.id : ''
    const label = typeof row.label === 'string' ? normalizeCatalogLabel(row.label) : ''
    if (id && label) canonicalById.set(id, label)
  }

  const initialCanonicalIds = canonicalSkillIds.filter((id) => canonicalById.has(id))
  const canonicalLabelTokens = new Set(
    initialCanonicalIds
      .map((id) => canonicalById.get(id))
      .filter((value): value is string => Boolean(value))
      .map((value) => normalizeCatalogToken(value))
  )

  const candidatesByLabel = new Map<string, string[]>()
  const allCandidates = new Set<string>()
  for (const label of cleanedLabels) {
    const tokens = skillLookupTokens(label)
    candidatesByLabel.set(label, tokens)
    for (const token of tokens) allCandidates.add(token)
  }

  const candidateList = Array.from(allCandidates)
  const [{ data: legacyAliasRows }, { data: canonicalAliasRows }, { data: slugRows }] = await Promise.all([
    candidateList.length
      ? params.supabase.from('skill_aliases').select('alias, skill_id').in('alias', candidateList)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    candidateList.length
      ? params.supabase.from('canonical_skill_aliases').select('alias, canonical_skill_id').in('alias', candidateList)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    candidateList.length
      ? params.supabase.from('skills').select('id, slug, normalized_name').in('slug', candidateList)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const aliasToSkillId = new Map<string, string>()
  for (const row of legacyAliasRows ?? []) {
    const alias = typeof row.alias === 'string' ? row.alias : ''
    const skillId = typeof row.skill_id === 'string' ? row.skill_id : ''
    if (alias && skillId) aliasToSkillId.set(alias, skillId)
  }
  for (const row of canonicalAliasRows ?? []) {
    const alias = typeof row.alias === 'string' ? row.alias : ''
    const skillId = typeof row.canonical_skill_id === 'string' ? row.canonical_skill_id : ''
    if (alias && skillId) aliasToSkillId.set(alias, skillId)
  }

  const slugToSkillId = new Map<string, string>()
  const normalizedToSkillId = new Map<string, string>()
  for (const row of slugRows ?? []) {
    const id = typeof row.id === 'string' ? row.id : ''
    const slug = typeof row.slug === 'string' ? row.slug : ''
    const normalized = typeof row.normalized_name === 'string' ? row.normalized_name : ''
    if (id && slug) slugToSkillId.set(slug, id)
    if (id && normalized) normalizedToSkillId.set(normalized, id)
  }

  const resolvedCanonicalIds = [...initialCanonicalIds]
  const seenCanonical = new Set(initialCanonicalIds)
  const customLabels: string[] = []
  const seenCustomToken = new Set<string>()

  for (const label of cleanedLabels) {
    const labelToken = normalizeCatalogToken(label)
    if (!labelToken || canonicalLabelTokens.has(labelToken)) continue

    const candidates = candidatesByLabel.get(label) ?? []
    let mappedId = ''
    for (const candidate of candidates) {
      mappedId = aliasToSkillId.get(candidate) ?? slugToSkillId.get(candidate) ?? normalizedToSkillId.get(candidate) ?? ''
      if (mappedId) break
    }

    if (mappedId) {
      if (!seenCanonical.has(mappedId)) {
        resolvedCanonicalIds.push(mappedId)
        seenCanonical.add(mappedId)
      }
      continue
    }

    if (!seenCustomToken.has(labelToken)) {
      seenCustomToken.add(labelToken)
      customLabels.push(label)
    }
  }

  let customSkillIds: string[] = []
  if (customLabels.length > 0) {
    const upsertRows = customLabels.map((label) => ({
      owner_type: params.ownerType,
      owner_id: params.ownerId,
      name: label,
      normalized_name: normalizeCatalogToken(label),
    }))
    const { error: customUpsertError } = await params.supabase
      .from('custom_skills')
      .upsert(upsertRows, { onConflict: 'owner_type,owner_id,normalized_name' })
    if (customUpsertError) {
      throw new Error(customUpsertError.message)
    }

    const normalizedNames = unique(customLabels.map((label) => normalizeCatalogToken(label)))
    const { data: customRows, error: customRowsError } = await params.supabase
      .from('custom_skills')
      .select('id, normalized_name')
      .eq('owner_type', params.ownerType)
      .eq('owner_id', params.ownerId)
      .in('normalized_name', normalizedNames)
    if (customRowsError) {
      throw new Error(customRowsError.message)
    }
    customSkillIds = (customRows ?? [])
      .map((row: Record<string, unknown>) => (typeof row.id === 'string' ? row.id : ''))
      .filter(Boolean)
  }

  const { data: resolvedCanonicalRows } = resolvedCanonicalIds.length
    ? await params.supabase
        .from('skills')
        .select('id, label')
        .in('id', resolvedCanonicalIds)
    : { data: [] as Array<Record<string, unknown>> }
  const canonicalLabels = unique(
    (resolvedCanonicalRows ?? [])
      .map((row: Record<string, unknown>) => (typeof row.label === 'string' ? normalizeCatalogLabel(row.label) : ''))
      .filter(Boolean)
  )

  return {
    canonicalSkillIds: resolvedCanonicalIds,
    customSkillIds,
    canonicalLabels,
    customLabels,
  }
}

export type SkillSearchOption = {
  id: string
  label: string
  category: string | null
}

export async function searchCanonicalSkills(params: {
  supabase: SupabaseLike
  query: string
  limit?: number
}) {
  const cleanQuery = normalizeCatalogLabel(params.query)
  const compact = normalizeCatalogToken(cleanQuery)
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 20), 5), 50)
  const baseLimit = Math.max(limit * 3, 60)
  const queryLower = cleanQuery.toLowerCase()

  const queryBuilder = params.supabase
    .from('skills')
    .select('id, label, category, slug, normalized_name, is_active, popularity_weight')
    .eq('is_active', true)

  const [{ data: directRows, error: directError }, { data: canonicalAliasRows, error: canonicalAliasError }, { data: legacyAliasRows, error: legacyAliasError }] =
    await Promise.all([
      compact.length >= 2
        ? queryBuilder
            .or(`label.ilike.%${cleanQuery}%,slug.ilike.%${cleanQuery}%,normalized_name.ilike.%${compact}%`)
            .limit(baseLimit)
        : queryBuilder.order('popularity_weight', { ascending: false }).order('label', { ascending: true }).limit(baseLimit),
      compact.length >= 2
        ? params.supabase
            .from('canonical_skill_aliases')
            .select('alias, canonical_skill_id')
            .ilike('alias', `%${cleanQuery}%`)
            .limit(baseLimit)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      compact.length >= 2
        ? params.supabase
            .from('skill_aliases')
            .select('alias, skill_id')
            .ilike('alias', `%${cleanQuery}%`)
            .limit(baseLimit)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    ])

  if (directError) throw new Error(directError.message)
  if (canonicalAliasError) throw new Error(canonicalAliasError.message)
  if (legacyAliasError) throw new Error(legacyAliasError.message)

  const aliasBySkillId = new Map<string, string[]>()
  for (const row of canonicalAliasRows ?? []) {
    const alias = typeof row.alias === 'string' ? row.alias.trim() : ''
    const skillId = typeof row.canonical_skill_id === 'string' ? row.canonical_skill_id : ''
    if (!alias || !skillId) continue
    if (!aliasBySkillId.has(skillId)) aliasBySkillId.set(skillId, [])
    aliasBySkillId.get(skillId)?.push(alias)
  }
  for (const row of legacyAliasRows ?? []) {
    const alias = typeof row.alias === 'string' ? row.alias.trim() : ''
    const skillId = typeof row.skill_id === 'string' ? row.skill_id : ''
    if (!alias || !skillId) continue
    if (!aliasBySkillId.has(skillId)) aliasBySkillId.set(skillId, [])
    aliasBySkillId.get(skillId)?.push(alias)
  }

  const directById = new Map<string, Record<string, unknown>>()
  for (const row of directRows ?? []) {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) continue
    directById.set(id, row)
  }

  const aliasSkillIds = Array.from(aliasBySkillId.keys()).filter((id) => !directById.has(id))
  if (aliasSkillIds.length > 0) {
    const { data: aliasSkillRows, error: aliasSkillRowsError } = await params.supabase
      .from('skills')
      .select('id, label, category, slug, normalized_name, is_active, popularity_weight')
      .eq('is_active', true)
      .in('id', aliasSkillIds)
      .limit(baseLimit)
    if (aliasSkillRowsError) throw new Error(aliasSkillRowsError.message)
    for (const row of aliasSkillRows ?? []) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id) continue
      directById.set(id, row)
    }
  }

  type RankedOption = SkillSearchOption & { score: number; popularity: number }
  const ranked: RankedOption[] = []

  for (const row of directById.values()) {
    const id = typeof row.id === 'string' ? row.id : ''
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    if (!id || !label) continue
    const category = typeof row.category === 'string' && row.category.trim().length > 0 ? row.category.trim() : null
    const slug = typeof row.slug === 'string' ? row.slug : ''
    const normalized = typeof row.normalized_name === 'string' ? row.normalized_name : normalizeCatalogToken(label)
    const popularity = typeof row.popularity_weight === 'number' ? row.popularity_weight : 0
    const aliases = aliasBySkillId.get(id) ?? []
    const labelLower = label.toLowerCase()

    let score = 0
    if (!compact) {
      score = popularity * 100
    } else {
      if (labelLower.startsWith(queryLower)) score += 180
      if (normalizeCatalogToken(label).startsWith(compact)) score += 160
      if (slug.startsWith(compact)) score += 130
      if (labelLower.includes(queryLower)) score += 80
      if (normalized.includes(compact)) score += 60
      const aliasPrefix = aliases.some((alias) => normalizeCatalogToken(alias).startsWith(compact))
      const aliasContains = aliases.some((alias) => normalizeCatalogToken(alias).includes(compact))
      if (aliasPrefix) score += 140
      else if (aliasContains) score += 70
      score += Math.min(60, Math.max(0, popularity))
    }

    ranked.push({ id, label, category, score, popularity })
  }

  return ranked
    .sort((a, b) => b.score - a.score || b.popularity - a.popularity || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ id, label, category }) => ({ id, label, category }))
}
