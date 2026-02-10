import {
  EMAIL_VERIFICATION_ERROR,
  requireVerifiedEmail,
  type EmailVerificationSubject,
} from './emailVerification'

export function guardApplicationSubmit(user: EmailVerificationSubject, listingId: string) {
  return requireVerifiedEmail({
    user,
    nextUrl: `/apply/${listingId}`,
    actionName: 'application_submit',
  })
}

export function guardEmployerInternshipPublish(user: EmailVerificationSubject) {
  return requireVerifiedEmail({
    user,
    nextUrl: '/dashboard/employer',
    actionName: 'internship_publish',
  })
}

export { EMAIL_VERIFICATION_ERROR }
