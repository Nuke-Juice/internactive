export function getMatchScoreTone(score: number | null | undefined) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'border-slate-300 bg-slate-100 text-slate-700'
  }
  if (score >= 80) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }
  if (score >= 60) {
    return 'border-amber-200 bg-amber-50 text-amber-900'
  }
  return 'border-rose-200 bg-rose-50 text-rose-900'
}
