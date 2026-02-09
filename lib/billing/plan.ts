export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED'

export function isPlanLimitReachedCode(code: string | null | undefined) {
  return code === PLAN_LIMIT_REACHED
}
