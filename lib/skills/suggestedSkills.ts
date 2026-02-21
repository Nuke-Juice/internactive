import { normalizeCatalogLabel, normalizeCatalogToken } from '@/lib/catalog/normalization'

type SuggestInput = {
  title: string
  category: string
  courseworkCategoryLabels: string[]
  selectedSkillLabels: string[]
  catalogLabels: string[]
  max?: number
}

const SUGGESTIONS_BY_KEYWORD: Array<{ keywords: string[]; skills: string[] }> = [
  {
    keywords: ['accounting', 'audit', 'controller', 'bookkeeping', 'tax'],
    skills: ['Excel', 'GAAP', 'Reconciliations', 'QuickBooks', 'Accounts Payable', 'Accounts Receivable'],
  },
  {
    keywords: ['finance', 'valuation', 'investment', 'asset', 'banking', 'fp&a'],
    skills: ['Financial Modeling', 'Valuation', 'DCF', 'Excel', 'Forecasting', 'PowerPoint'],
  },
  {
    keywords: ['data', 'analytics', 'analyst', 'business intelligence', 'bi'],
    skills: ['SQL', 'Tableau', 'Power BI', 'Python', 'Statistics', 'Data Visualization'],
  },
  {
    keywords: ['software', 'engineering', 'developer', 'frontend', 'backend', 'full stack'],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Git', 'APIs'],
  },
  {
    keywords: ['sales', 'business development', 'bdr', 'sdr'],
    skills: ['CRM', 'Salesforce', 'Lead Generation', 'Cold Outreach', 'Prospecting', 'Communication'],
  },
  {
    keywords: ['marketing', 'growth', 'seo', 'content'],
    skills: ['SEO', 'Content Strategy', 'Marketing Analytics', 'CRM', 'Copywriting', 'Social Media'],
  },
  {
    keywords: ['operations', 'supply chain', 'procurement', 'logistics'],
    skills: ['Project Management', 'SOP Development', 'Inventory Management', 'Procurement', 'Scheduling', 'Lean'],
  },
]

const COURSEWORK_TO_SKILLS: Array<{ coursework: string[]; skills: string[] }> = [
  { coursework: ['sql', 'database'], skills: ['SQL', 'Databases'] },
  { coursework: ['statistics', 'regression', 'probability', 'econometrics'], skills: ['Statistics', 'Regression Analysis'] },
  { coursework: ['data visualization', 'tableau', 'power bi'], skills: ['Data Visualization', 'Tableau', 'Power BI'] },
  { coursework: ['financial accounting', 'managerial accounting'], skills: ['GAAP', 'Journal Entries', 'Reconciliations'] },
  { coursework: ['corporate finance', 'valuation'], skills: ['Financial Modeling', 'Valuation', 'DCF'] },
  { coursework: ['algorithms', 'data structures'], skills: ['Problem Solving', 'Algorithms', 'Programming'] },
]

export function suggestSkillsForListing(input: SuggestInput) {
  const max = Math.max(3, Math.min(input.max ?? 10, 16))
  const catalogByToken = new Map<string, string>()
  for (const label of input.catalogLabels) {
    const normalized = normalizeCatalogLabel(label)
    const token = normalizeCatalogToken(normalized)
    if (!token) continue
    if (!catalogByToken.has(token)) catalogByToken.set(token, normalized)
  }

  const selectedTokens = new Set(input.selectedSkillLabels.map((label) => normalizeCatalogToken(label)).filter(Boolean))
  const keywordBlob = normalizeCatalogLabel(`${input.title} ${input.category}`).toLowerCase()
  const suggestionQueue: string[] = []

  for (const group of SUGGESTIONS_BY_KEYWORD) {
    if (!group.keywords.some((keyword) => keywordBlob.includes(keyword))) continue
    suggestionQueue.push(...group.skills)
  }

  const courseworkTokens = input.courseworkCategoryLabels.map((label) => normalizeCatalogLabel(label).toLowerCase())
  for (const mapping of COURSEWORK_TO_SKILLS) {
    const hit = courseworkTokens.some((coursework) => mapping.coursework.some((needle) => coursework.includes(needle)))
    if (hit) suggestionQueue.push(...mapping.skills)
  }

  const deduped: string[] = []
  const seenTokens = new Set<string>()
  for (const raw of suggestionQueue) {
    const token = normalizeCatalogToken(raw)
    if (!token || seenTokens.has(token) || selectedTokens.has(token)) continue
    seenTokens.add(token)
    const canonical = catalogByToken.get(token)
    if (canonical) {
      deduped.push(canonical)
      continue
    }
    // Fallback: keep suggestion text if not found in current catalog snapshot.
    deduped.push(normalizeCatalogLabel(raw))
  }

  return deduped.slice(0, max)
}
