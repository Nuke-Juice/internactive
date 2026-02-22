# Profile Completeness Inventory

Current completeness logic references discovered during bugfix:

- `/Users/alex.eggertsen/projects/internactive/src/profile/profileCompleteness.ts`
  - Canonical weighted completeness logic (`computeProfileCompleteness`, `getProfileCompleteness`).
- `/Users/alex.eggertsen/projects/internactive/src/profile/getStudentProfileCompleteness.ts`
  - Server-side canonical fetch + compute helper (added in this fix).
- `/Users/alex.eggertsen/projects/internactive/components/jobs/JobsView.tsx`
  - Browse/home profile completion banner now reads canonical helper output.
- `/Users/alex.eggertsen/projects/internactive/app/student/dashboard/page.tsx`
  - Profile Setup card now reads canonical helper output.

Legacy minimum-profile checks still exist outside this bugfix scope (for gating and non-banner flows):

- `/Users/alex.eggertsen/projects/internactive/lib/profileCompleteness.ts`
- `/Users/alex.eggertsen/projects/internactive/components/account/StudentAccount.tsx`
- `/Users/alex.eggertsen/projects/internactive/app/account/page.tsx`
- `/Users/alex.eggertsen/projects/internactive/lib/auth/postAuthRedirect.ts`
- `/Users/alex.eggertsen/projects/internactive/app/jobs/_components/applyActions.ts`
- `/Users/alex.eggertsen/projects/internactive/app/student/dashboard/[section]/page.tsx`
- `/Users/alex.eggertsen/projects/internactive/app/api/admin/students/[studentId]/details/route.ts`
