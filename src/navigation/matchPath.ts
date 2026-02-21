import type { NavMatchMode } from '@/src/navigation/navConfig'

export type MatchableNavItem = {
  id: string
  href: string
  match?: NavMatchMode
  activeOn?: string[]
  order?: number
}

function normalizePath(pathname: string) {
  const [pathOnly] = pathname.split(/[?#]/, 1)
  if (!pathOnly) return '/'
  if (pathOnly.length > 1 && pathOnly.endsWith('/')) return pathOnly.slice(0, -1)
  return pathOnly
}

function matchesPath(pathname: string, target: string, mode: NavMatchMode) {
  const normalizedPathname = normalizePath(pathname)
  const normalizedTarget = normalizePath(target)

  if (mode === 'exact') {
    return normalizedPathname === normalizedTarget
  }

  if (normalizedTarget === '/') return normalizedPathname === '/'
  return normalizedPathname === normalizedTarget || normalizedPathname.startsWith(`${normalizedTarget}/`)
}

export function matchPath(pathname: string, items: MatchableNavItem[]) {
  const normalizedPathname = normalizePath(pathname)
  let activeId: string | null = null
  let bestScore = -1

  for (const item of items) {
    const mode = item.match ?? 'prefix'
    const patterns = [item.href, ...(item.activeOn ?? [])]

    for (const pattern of patterns) {
      if (!matchesPath(normalizedPathname, pattern, mode)) continue
      const score = normalizePath(pattern).length * 100 + (item.order ?? 0)
      if (score > bestScore) {
        bestScore = score
        activeId = item.id
      }
    }
  }

  return activeId
}
