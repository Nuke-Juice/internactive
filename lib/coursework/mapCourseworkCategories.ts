import 'server-only'

import { normalizeCatalogToken } from '@/lib/catalog/normalization'
import { supabaseServer } from '@/lib/supabase/server'

const KEYWORD_CATEGORY_MAP: Array<{ category: string; keywords: string[] }> = [
  { category: 'corporatefinancevaluation', keywords: ['corporate finance', 'valuation', 'fin340', 'finance340'] },
  { category: 'financialaccounting', keywords: ['financial accounting', 'intermediate accounting', 'acct310', 'acctg310'] },
  { category: 'managerialaccounting', keywords: ['managerial accounting', 'cost accounting'] },
  { category: 'financialmodelingexcel', keywords: ['financial modeling', 'excel', 'spreadsheet modeling'] },
  { category: 'investmentsportfoliotheory', keywords: ['investments', 'portfolio theory', 'asset pricing'] },
  { category: 'statisticsprobability', keywords: ['statistics', 'probability'] },
  { category: 'econometricsregression', keywords: ['econometrics', 'regression'] },
  { category: 'sqldatabases', keywords: ['sql', 'database', 'databases'] },
  { category: 'datavisualizationtableaupowerbi', keywords: ['tableau', 'power bi', 'data visualization', 'dashboard'] },
  { category: 'marketinganalytics', keywords: ['marketing analytics', 'digital analytics'] },
  { category: 'operationssupplychain', keywords: ['operations', 'supply chain'] },
  { category: 'productmanagementfundamentals', keywords: ['product management', 'product strategy'] },
  { category: 'softwareengineeringfundamentals', keywords: ['software engineering', 'data structures', 'algorithms'] },
]

export async function mapCourseworkTextToCategories(textInput: string[]) {
  const supabase = await supabaseServer()
  const { data: categories } = await supabase
    .from('coursework_categories')
    .select('id, name, normalized_name')
    .order('name', { ascending: true })

  const normalizedToCategory = new Map<string, { id: string; name: string }>()
  for (const row of categories ?? []) {
    if (typeof row.normalized_name === 'string' && typeof row.id === 'string') {
      normalizedToCategory.set(row.normalized_name, { id: row.id, name: String(row.name ?? row.normalized_name) })
    }
  }

  const mappedIds = new Set<string>()
  const mappedNames = new Set<string>()

  for (const raw of textInput) {
    const text = raw.trim().toLowerCase()
    const compact = normalizeCatalogToken(raw)
    if (!text && !compact) continue

    for (const rule of KEYWORD_CATEGORY_MAP) {
      const category = normalizedToCategory.get(rule.category)
      if (!category) continue
      const hasMatch = rule.keywords.some((keyword) => text.includes(keyword) || compact.includes(normalizeCatalogToken(keyword)))
      if (hasMatch) {
        mappedIds.add(category.id)
        mappedNames.add(category.name)
      }
    }
  }

  return {
    categoryIds: Array.from(mappedIds),
    categoryNames: Array.from(mappedNames),
  }
}
