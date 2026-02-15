# SYSTEM_AUDIT_PACK.md

## 1) C4-style Architecture (as-built)

### System Context
- Actors:
  - `student`: discovers internships, quick-applies, tracks applications.
  - `employer`: creates/publishes listings, reviews applicants, exports shortlist.
  - `ops_admin` / `super_admin`: moderates listings, edits/deletes listings, can act across tenants.
- External services:
  - Supabase Auth/DB/Storage (`lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/client.ts`).
  - Stripe Billing + webhooks (`lib/billing/actions.ts`, `app/api/stripe/webhook/route.ts`).
  - Email provider (Resend) for employer alerts (`lib/email/employerAlerts.ts`).
  - Cloudflare Turnstile for signup bot protection (`components/security/TurnstileWidget.tsx`, `app/api/turnstile/verify/route.ts`).

### Container View
- Web app container: Next.js App Router pages/components under `app/**`, `components/**`.
- Server action container: route-local server actions in page files:
  - Employer listing lifecycle: `app/dashboard/employer/page.tsx` (`createInternship`, `publishDraft`, `toggleInternshipActive`, `deleteDraft`, `deletePublishedInternship`).
  - Student apply lifecycle: `app/apply/[listingId]/page.tsx` (`submitApplication`, `markExternalApplyCompleted`).
  - Employer applicant review: `app/dashboard/employer/applicants/page.tsx` (`updateApplication`).
  - Admin moderation: `app/admin/internships/page.tsx` (`toggleActive`, `deleteInternship`) and `app/admin/internships/[id]/page.tsx` (`updateInternship`).
- Supabase data container: relational tables + RLS in `supabase/migrations/*.sql`.
- Storage container: resumes bucket policies in `supabase/migrations/202602100008_rls_and_resume_storage_hardening.sql`.
- Stripe webhook container: `app/api/stripe/webhook/route.ts` writes `subscriptions`, `stripe_customers`, dedupes via `stripe_webhook_events`.

### Component View (major modules/paths)
- Auth entry points:
  - Login: `app/login/page.tsx`.
  - Signup: `app/signup/student/page.tsx`, `app/signup/employer/page.tsx`.
  - OAuth launch: `components/auth/OAuthButtons.tsx`.
  - OAuth/email callback: `app/auth/callback/route.ts`.
  - Verify-required page: `app/verify-required/page.tsx`.
  - Post-auth routing: `lib/auth/postAuthRedirect.ts`.
- Listing wizard:
  - Route: `app/dashboard/employer/new/page.tsx` (delegates to dashboard create mode).
  - Wizard UI: `components/employer/listing/ListingWizard.tsx`.
  - Server action save/publish: `app/dashboard/employer/page.tsx` (`createInternship`).
- Jobs feed:
  - Public route: `app/page.tsx` -> `components/jobs/JobsView.tsx`.
  - Feed data/query: `lib/jobs/internships.ts`.
  - Matching/ranking: `lib/matching.ts` via `rankInternships`.
- Apply flow:
  - Detail CTA: `app/jobs/[id]/page.tsx` + `app/jobs/_components/ApplyButton.tsx`.
  - Apply page + quick apply: `app/apply/[listingId]/page.tsx`, `app/apply/[listingId]/QuickApplyPanel.tsx`.
  - Quick apply action helper (micro onboarding path): `app/jobs/_components/applyActions.ts` (`applyFromMicroOnboardingAction`).
  - ATS bridge click + safe redirect: `app/apply/[listingId]/external/route.ts`, `lib/apply/externalApply.ts`.
- Employer dashboard + applicant inbox:
  - Dashboard/listings: `app/dashboard/employer/page.tsx`.
  - Applicants inbox: `app/dashboard/employer/applicants/page.tsx`.
  - CSV export: `app/dashboard/employer/applicants/export/route.ts`.
- Admin moderation + controls:
  - Listings dashboard: `app/admin/internships/page.tsx`.
  - Listing edit: `app/admin/internships/[id]/page.tsx`.
  - Admin queue UI components: `components/admin/ListingsQueue.tsx`, `components/admin/ListingRowActions.tsx`.

## 2) End-to-end Sequence Flows (exact implementation)

### A) Student signup -> verify -> onboarding (multi-step)
1. User opens `/signup/student` (`app/signup/student/page.tsx`) and completes Turnstile via `/api/turnstile/verify`.
2. `supabase.auth.signUp` runs client-side with redirect to `/auth/callback?next=/signup/student/details`.
3. User is sent to `/verify-required?...` pending email confirmation.
4. Verification link hits `/auth/callback` (`app/auth/callback/route.ts`), which exchanges code/OTP and upserts `users` row (role hint handling).
5. `resolvePostAuthRedirect` (`lib/auth/postAuthRedirect.ts`) routes verified student to `/signup/student/details` until onboarding complete.
6. `/signup/student/details` (`app/signup/student/details/page.tsx`) loads/initializes role (`users` upsert role `student`) and syncs `users.verified=true`.
7. On finish (`saveProfileDetails`):
   - Writes `users` (role), `student_profiles` (upsert on `user_id`), and Auth metadata (`first_name`, `last_name`, resume fields).
   - Writes skill/coursework links: `student_coursework_items`, `student_courses`, `student_coursework_category_links`.
   - Optional resume upload to Storage bucket `resumes`.
8. Redirect to `/`.

### B) Employer signup -> verify -> onboarding (multi-step)
1. User opens `/signup/employer` (`app/signup/employer/page.tsx`), passes Turnstile.
2. Client `supabase.auth.signUp` sets redirect `/auth/callback?next=/signup/employer/details`.
3. User sees `/verify-required` until confirmed.
4. `/auth/callback` upserts `users` row and resolves destination.
5. `/signup/employer/details` (`app/signup/employer/details/page.tsx`) enforces verified email, sets `users.role='employer'`, syncs `users.verified=true`.
6. On finish (`saveProfileDetails`):
   - Upserts `users`, `employer_profiles`, and `employer_public_profiles`.
   - Updates Auth metadata names.
   - Optional logo upload into `avatars`/`profile-photos`.
7. Redirect to `/dashboard/employer`.

### C) Employer creates draft -> publish -> appears on dashboard + public feed
1. Employer opens `/dashboard/employer/new` (delegates to `app/dashboard/employer/page.tsx` create mode).
2. Listing wizard posts to server action `createInternship(formData)`.
3. For draft mode: writes `internships` with `status='draft'`, `is_active=false`; updates canonical link tables (`internship_required_skill_items`, `internship_preferred_skill_items`, `internship_required_course_categories`, `internship_major_links`).
4. For publish mode: same action performs:
   - verified-email guard (`guardEmployerInternshipPublish`),
   - plan capacity check (`getEmployerInternshipCounts` + plan max),
   - publish validations (`validateListingForPublish`, `validateInternshipInput`),
   - writes `internships` with `status='published'`, `is_active=true`,
   - writes canonical link tables,
   - analytics event `employer_listing_published`.
5. Action revalidates `/dashboard/employer` + `/dashboard/employer/new`, redirects with `published_id`.
6. Public feed includes listing because `fetchInternships` (`lib/jobs/internships.ts`) filters on `is_active=true` and non-expired `application_deadline`.

### D) Student discovers feed -> ranking -> detail -> applies (+ ATS completion)
1. Student opens `/` (`app/page.tsx` -> `JobsView`).
2. `JobsView` fetches active listings (`fetchInternships`) and student profile data (users role, `student_profiles`, skill/coursework link tables).
3. If role is student and sort=`best_match`, `rankInternships` (`lib/matching.ts`) computes score/reasons/gaps; only `eligible` listings retained.
4. Student opens `/jobs/[id]`; page computes per-listing match via `evaluateInternshipMatch` and logs `view_job_detail` analytics.
5. Student clicks apply to `/apply/[listingId]`:
   - `submitApplication` validates role/profile/resume/listing.
   - Builds snapshot via `buildApplicationMatchSnapshot`.
   - Inserts `applications` (`status='submitted'`, `match_score`, `match_reasons`, `match_gaps`, `matching_version`, ATS flags).
6. If apply mode is `ats_link`/`hybrid`, redirect to completion stage `?stage=complete&application=...`.
7. Student clicks external bridge `/apply/[listingId]/external?application=...`; route validates ownership, increments click counters, redirects (307) to normalized HTTPS ATS URL.
8. Student marks completion via `markExternalApplyCompleted`, updating `applications.external_apply_completed_at`.

### E) Employer views applicants -> changes status -> exports shortlist
1. Employer opens `/dashboard/employer/applicants`.
2. Page loads employer’s internships + scoped applications (optional filters/sort by `match_score` or `created_at`).
3. Employer submits `updateApplication` action:
   - Verifies internship ownership.
   - Updates `applications.status`, `applications.notes`, `applications.reviewed_at`.
   - Redirects with `updated=1`.
4. Export via `/dashboard/employer/applicants/export[?internship_id=...]` returns CSV from `applications` + internship title map.

### F) Admin moderates internships -> deactivate -> delete (with confirm)
1. Admin enters `/admin/internships` (guarded by middleware + `requireAnyRole(ADMIN_ROLES)`).
2. Deactivate/activate action `toggleActive` updates `internships.is_active`.
3. Delete action `deleteInternship` requires `confirmation_phrase=DELETE`.
4. Delete flow manually removes dependent rows from:
   - `applications`, `internship_required_skill_items`, `internship_preferred_skill_items`,
   - `internship_required_course_categories`, `internship_coursework_items`, `internship_coursework_category_links`,
   - `internship_major_links`, `internship_events`, `employer_claim_tokens`,
   then deletes row from `internships`.
5. Revalidates `/admin/internships`, `/`, `/jobs`, `/jobs/[id]`.

## 3) Data Model Summary (key tables)

- `users`
  - Key: `id` (UUID, referenced broadly), role enum + `verified`.
  - Used for role gates and verification sync (`requireRole`, middleware, auth callback).
- `student_profiles`
  - Logical key: `user_id` (upsert on `user_id` in signup/details).
  - Important fields: school/major/year/coursework, availability fields, preference/commute fields.
  - Used by matching, apply gating, profile completeness checks.
- `employer_profiles`
  - Logical key: `user_id` (upsert on `user_id`).
  - Important fields: `company_name`, `location_address_line1`, location fields, contact email, verification override flags, email alerts.
  - Used by employer onboarding, plan verification behavior, listings context.
- `internships`
  - Key: `id`.
  - Visibility/gating fields: `is_active`, `status`, `application_deadline`/`apply_deadline`, `employer_id`.
  - Matching fields: majors/year/work mode/term/hours/pay/category, canonical link companions.
  - Apply routing fields: `apply_mode`, `external_apply_url`, `external_apply_type`.
- `applications`
  - Key: `id`; unique `(student_id, internship_id)` via `applications_student_id_internship_id_key`.
  - Review fields: `status`, `reviewed_at`, `notes`.
  - Snapshot fields: `match_score`, `match_reasons`, `match_gaps`, `matching_version`.
  - ATS fields: `external_apply_required`, `external_apply_completed_at`, click metrics.
- Skills model:
  - `skills` (canonical skill rows), `skill_aliases`.
  - `student_skill_items` (student<->skill).
  - `internship_required_skill_items`, `internship_preferred_skill_items` (listing<->skill).
- Coursework model:
  - `coursework_items`, `coursework_categories`, `coursework_item_category_map`.
  - `student_coursework_items`, `student_coursework_category_links`.
  - `internship_coursework_items`, `internship_coursework_category_links`.
  - Structured categories: `canonical_course_categories`, `canonical_courses`, `student_courses`, `internship_required_course_categories`.
- Plan/Billing:
  - `stripe_customers` (`user_id` -> Stripe customer id).
  - `subscriptions` (`user_id` -> Stripe subscription status/price/period).
  - `stripe_webhook_events` dedupe ledger for webhook idempotency.
- Analytics:
  - `analytics_events` generic events (`event_name`, `properties`, `user_id`).
  - `internship_events` listing-level event stream (`view`/`click`/`apply`, dedupe key).

## 4) RLS + Role Gates Summary

### Relevant RLS policies (current migration baseline)
- Source of truth: `supabase/migrations/202602100008_rls_and_resume_storage_hardening.sql` + `202602110001_fix_users_policy_recursion.sql`.
- Internships:
  - `internships_select_access`: readable if `is_active=true` OR owner OR admin.
  - `internships_insert_access`: owner or admin.
  - `internships_update_access`: owner or admin.
  - `internships_delete_access`: owner or admin.
- Applications:
  - `applications_select_access`: student owner OR internship owner employer OR admin.
  - `applications_insert_access`: student owner or admin.
  - `applications_update_access`: internship owner employer or admin.
- Profiles:
  - `student_profiles_select_access` / `insert_access` / `update_access`: owner or admin.
  - `employer_profiles_select_access` / `update_access`: owner or admin.
- Users:
  - `users_select_access`: self or admin.
  - `users_update_access`: self or admin (plus trigger `prevent_unauthorized_user_role_change`).

### Server-side role gates
- Admin route boundary:
  - `middleware.ts` with matcher `/admin/:path*` checks authenticated + admin role; otherwise `/login` or `/unauthorized`.
- Per-page/action role guards:
  - `lib/auth/requireRole.ts` for single-role pages/actions (`student`, `employer`).
  - `lib/auth/requireAnyRole.ts` for admin role sets (`ops_admin`, `super_admin`).
- Verification gates:
  - `lib/auth/verifiedActionGate.ts` (`guardEmployerInternshipPublish`, `guardApplicationSubmit`) to route to `/verify-required`.

### RLS drift risks (as-built)
- `status` vs `is_active` drift:
  - Visibility depends on `is_active` policy/filter; some writes set only one or can diverge (`app/admin/internships/page.tsx` `toggleActive` updates only `is_active`).
- Owner-write/admin-read asymmetry risk:
  - Employer actions use user-scoped client while admin uses service role client; inconsistent behavior can appear between admin and employer UIs for same row state.
- Policy evolution drift:
  - `supabase/rls_policies.sql` is legacy and differs from hardened migration policies; operational docs can become stale if teams reference wrong file.

## 5) Matching + Ranking Summary (as-built)

- Execution location:
  - Server-side in React Server Components/pages (`components/jobs/JobsView.tsx`, `app/jobs/[id]/page.tsx`, `lib/applicationMatchSnapshot.ts`).
- Version:
  - `MATCHING_VERSION = 'v1.2'` (`lib/matching.ts`).
- Hard gates (ineligible -> removed from ranked feed):
  - Deadline passed, remote-only conflict, hours exceed availability, strict preference/term mismatches, graduation year mismatch, experience mismatch.
- Soft signals / penalties:
  - Weighted contributions with negatives for term/preference/start-date mismatches (`DEFAULT_MATCHING_WEIGHTS` in `lib/matching.ts`).
- Weights + normalization:
  - Raw weighted sum across signals, normalized by max possible, converted to `0..100` integer (`score100`).
- Explainability surfaces:
  - Reasons/gaps returned by evaluator (`reasons`, `gaps`), shown in feed top reasons and job detail “Why this match”.
- Tie-breakers:
  - `score` desc -> `created_at` desc -> `internship.id` lexical.
- Premium gating status:
  - Ranking in student feed is not paywalled; premium features are mainly employer inbox sorting/filters (`lib/billing/plan.ts`).
- Match score persistence:
  - Stored on `applications.match_score` as integer `0..100`; plus `match_reasons`, `match_gaps`, `matching_version`.

## 6) Plan Limits + Enforcement (as-built)

- Canonical “active internship”:
  - `is_active === true` (`lib/internships/employerCounts.ts`), regardless of `status` string.
- Enforcement points:
  - `createInternship` (publish path) in `app/dashboard/employer/page.tsx`.
  - `publishDraft` in `app/dashboard/employer/page.tsx`.
  - `toggleInternshipActive` when activating in `app/dashboard/employer/page.tsx`.
- Limit behavior:
  - Compares current active count vs plan `maxActiveInternships` (`lib/billing/plan.ts`, `getEmployerVerificationStatus`).
  - On hit: redirect with `code=PLAN_LIMIT_REACHED`, UI banner/modal and upgrade affordances.
- Dashboard counting:
  - Uses `getEmployerInternshipCounts` / `summarizeEmployerInternshipCounts` over `internships` rows for owner, counting only `is_active=true`.

## 7) Known Failure Modes Checklist (with code pointers)

- [ ] Revalidation gaps after employer server actions: employer publish/toggle/delete revalidate dashboard paths but not explicit public feed paths (`app/dashboard/employer/page.tsx`).
- [ ] `status`/`is_active` semantics mismatch: multiple code paths read both; activation logic primarily keys off `is_active`, while status may lag (`lib/internships/employerCounts.ts`, `app/dashboard/employer/page.tsx`, `app/dashboard/employer/analytics/page.tsx`).
- [ ] `location_type`/`work_mode` string drift risk across migrations and canonicalization (`supabase/migrations/202602110006_internship_listing_alignment.sql`, `202602140004_work_mode_in_person_canonical.sql`, `app/dashboard/employer/page.tsx`).
- [ ] Duplicate deadline fields with mixed usage (`application_deadline` and `apply_deadline`) across pages/actions (`app/dashboard/employer/page.tsx`, `lib/jobs/internships.ts`, `app/admin/internships/page.tsx`).
- [ ] ATS link handling / redirect safety: normalization blocks non-HTTPS/js/data and internal admin/dashboard paths but allows arbitrary external HTTPS host (`lib/apply/externalApply.ts`, `app/apply/[listingId]/external/route.ts`).
- [ ] Delete dependency drift risk: admin delete manually enumerates child tables; future child tables may be missed unless FK cascades are consistent (`app/admin/internships/page.tsx` `deleteInternship`).

## 8) How to Reproduce Critical Loops (manual QA)

### Publish listing + verify visibility
1. Sign in as employer at `/login`.
2. Open `/dashboard/employer/new`.
3. Fill required fields and publish (wizard submits to `createInternship`).
4. Confirm redirect includes `published_id` on `/dashboard/employer`.
5. Open `/jobs/{published_id}` and `/` to confirm listing appears publicly.

### Apply + verify application row + snapshot
1. Sign in as student and ensure profile/resume present (`/account`).
2. Open listing detail `/jobs/{listing_id}` and click Apply.
3. On `/apply/{listing_id}`, submit quick apply.
4. Verify row exists in `applications` with `student_id`, `internship_id`, `status='submitted'`, non-null `match_score`/`matching_version`.
5. If ATS/hybrid listing: click external bridge and complete stage; verify `external_apply_completed_at` updates.

### Employer review + status persistence
1. Sign in as employer owning the listing.
2. Open `/dashboard/employer/applicants`.
3. Update applicant status/notes via inline form (calls `updateApplication`).
4. Reload page; verify status/notes persist and `reviewed_at` is set.
5. Export CSV from `/dashboard/employer/applicants/export` and verify row appears.

### Admin delete listing + verify public disappearance
1. Sign in as admin (`ops_admin`/`super_admin`).
2. Open `/admin/internships`.
3. Click Delete on target listing, type `DELETE`, submit.
4. Confirm success banner and listing removed from table.
5. Visit `/jobs/{listing_id}` and `/` to verify listing no longer appears publicly.
