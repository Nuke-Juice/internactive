export const PLAN_LIMIT_REACHED = 'PLAN_LIMIT_REACHED'

export type EmployerPlanId = 'free' | 'starter' | 'pro'

export type EmployerPlan = {
  id: EmployerPlanId
  name: string
  monthlyPriceCents: number
  maxActiveInternships: number | null
  emailAlertsEnabled: boolean
  valueProp: string
}

export const EMPLOYER_PLANS: Record<EmployerPlanId, EmployerPlan> = {
  free: {
    id: 'free',
    name: 'Free Employer',
    monthlyPriceCents: 0,
    maxActiveInternships: 1,
    emailAlertsEnabled: false,
    valueProp: 'Start posting with core matching.',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPriceCents: 4900,
    maxActiveInternships: 3,
    emailAlertsEnabled: true,
    valueProp: 'Post more roles and get email alerts.',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPriceCents: 9900,
    maxActiveInternships: null,
    emailAlertsEnabled: true,
    valueProp: 'Unlimited postings for growing teams.',
  },
}

export function getEmployerPlan(planId: EmployerPlanId) {
  return EMPLOYER_PLANS[planId]
}

export function isUnlimitedInternships(plan: EmployerPlan) {
  return plan.maxActiveInternships === null
}

export function getRemainingCapacity(plan: EmployerPlan, currentActiveInternships: number) {
  if (plan.maxActiveInternships === null) return null
  return Math.max(0, plan.maxActiveInternships - currentActiveInternships)
}

export function isPlanLimitReachedCode(code: string | null | undefined) {
  return code === PLAN_LIMIT_REACHED
}
