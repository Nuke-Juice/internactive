import { isFeedEligible } from './feedEligibility.ts'

export type InternshipViewerRole = 'student' | 'employer' | 'admin' | null

export type InternshipViewerContext = {
  viewerId: string | null
  viewerRole: InternshipViewerRole
}

export type InternshipAccessRow = {
  id: string
  employer_id: string | null
  is_active: boolean | null
  status: string | null
  application_deadline: string | null
}

export function canViewerAccessInternship(input: {
  row: InternshipAccessRow
  viewer: InternshipViewerContext
}) {
  if (input.viewer.viewerRole === 'admin') return true
  if (
    input.viewer.viewerRole === 'employer' &&
    input.viewer.viewerId &&
    input.row.employer_id === input.viewer.viewerId
  ) {
    return true
  }
  return isFeedEligible({
    is_active: input.row.is_active,
    status: input.row.status,
    application_deadline: input.row.application_deadline,
  })
}
