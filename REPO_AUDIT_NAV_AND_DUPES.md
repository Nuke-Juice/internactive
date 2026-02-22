# Repo Audit: Navigation + Duplicates (Phase 0)

Date: 2026-02-21
Scope: Inventory only. No behavior changes in this phase.

## 1) Navigation Components Inventory

| File | Role(s) | Routes Covered | Current API/Pattern | Notes |
|---|---|---|---|---|
| `components/layout/SiteHeader.tsx` | shared global header (student/employer/admin/public) | all routes (via root layout) | props: `isAuthenticated`, `role`, notification dots; internal active checks via pathname | Primary top nav differs per role; student gets icon links for Applications/Inbox. Contains role-specific nav logic separate from admin/employer dashboard nav components. |
| `components/layout/AppShellClient.tsx` | shared | all routes | wrapper around `SiteHeader` + toasts | Global shell entrypoint. |
| `components/employer/EmployerWorkspaceNav.tsx` | employer | `/dashboard/employer`, `/dashboard/employer/applicants`, `/dashboard/employer/analytics`, `/dashboard/employer/messages` | props: `activeTab`, `selectedInternshipId`, `internships`, `includeAllOption`; renders tab pills + listing selector | Employer-specific workspace nav; includes tab active logic and internship-context query propagation. |
| `components/employer/EmployerDashboardHeader.tsx` | employer | mostly listings/applicants/analytics pages | props: `title`, `description`, `activeTab` (`listings \| applicants \| analytics`), internship context props | Wrapper that embeds `EmployerWorkspaceNav`. Inconsistency: `messages` tab not in this API, so messages page bypasses header wrapper. |
| `components/admin/AdminSectionNav.tsx` | admin | `/admin/*` via `app/admin/layout.tsx` | internal static `NAV_ITEMS`, `match(pathname)` per item; desktop card nav + mobile select | Separate admin-only nav system with different API and active-state logic than employer/global. |
| `components/admin/ListingsQueue.tsx` | admin (secondary tab set) | `/admin/listings-queue?tab=*` | local `tabs` state/links (`pending`, `flagged`, `recent`) | Secondary tabs implemented locally (not shared nav primitives). |
| `app/student/dashboard/page.tsx` + `app/student/dashboard/[section]/page.tsx` | student | `/student/dashboard`, `/student/dashboard/*` | no shared nav component; uses dashboard cards + detail pages with back link | Student dashboard navigation is page-local and structurally different from employer/admin. |
| `components/employer/inbox/EmployerApplicantsInboxClient.tsx` | employer (secondary tabs) | `/dashboard/employer/applicants` | local tabs (`new`, `invited`, `completed`, `finalists`) + filter/export controls | In-page tab system; not part of shared dashboard nav. |

### Confirmed nav/pattern inconsistencies

- Active-state logic is duplicated across `SiteHeader`, `EmployerWorkspaceNav`, and `AdminSectionNav`.
- Employer messages page uses `EmployerWorkspaceNav` directly while other employer dashboard pages use `EmployerDashboardHeader`.
- Student dashboard has no reusable workspace nav component; navigation is implicit via cards and back links.
- Multiple local tab systems exist (`AdminSectionNav`, `ListingsQueue`, `EmployerApplicantsInboxClient`) with different styling/API.

---

## 2) Route Map by Role

## Student / Applicant

Primary:
- `/student/dashboard`
- `/student/dashboard/[section]` (`action-center`, `profile-strength`, `application-analytics`, `resume-analyzer`, `course-strategy`, `match-optimization`)
- `/applications`
- `/inbox` (role-aware content)
- `/student/upgrade`

Legacy/alias:
- `/dashboard/student` -> permanent redirect to `/student/dashboard`

Shared routes used by students:
- `/jobs`, `/jobs/[id]`, `/apply/[listingId]`, `/notifications`, `/account`, `/profile`

## Employer

Primary:
- `/dashboard/employer` (listings)
- `/dashboard/employer/new` (create/edit wrapper flow)
- `/dashboard/employer/applicants`
- `/dashboard/employer/applicants/review/[applicationId]`
- `/dashboard/employer/messages`
- `/dashboard/employer/analytics`
- `/dashboard/employer/settings`

Alias:
- `/employer` -> redirect to `/dashboard/employer`

Employer-related route handlers:
- `/dashboard/employer/applicants/export`
- `/dashboard/employer/applicants/view/[applicationId]`

## Admin

Primary:
- `/admin`
- `/admin/listings-queue`
- `/admin/internships`
- `/admin/internships/new`
- `/admin/internships/[id]`
- `/admin/internships/[id]/applicants`
- `/admin/employers`
- `/admin/students`
- `/admin/matching/preview`
- `/admin/matching/report`

Admin layout nav injection:
- `/admin/layout` renders `AdminSectionNav` for all admin pages.

---

## 3) Suspected Duplicates (Components + Routes)

Status legend:
- `Keep`: retain as canonical now.
- `Merge`: consolidate into one implementation.
- `Delete`: remove after verified no runtime/dynamic references.

| Item | Evidence | Recommendation | Why |
|---|---|---|---|
| `components/forms/CatalogMultiSelect.tsx` vs `app/admin/internships/_components/CatalogMultiSelect.tsx` | Same name, overlapping behavior (select chips, query filter, hidden fields). Admin copy is reduced version. | `Merge` | Clear duplicate component behavior; should share canonical base in `components/forms`. |
| `app/admin/internships/page.tsx` vs `app/admin/internships/new/page.tsx` | Very large overlap (1110 LOC vs 1315 LOC; long diff with mostly parallel create/listing logic). | `Merge` | High maintenance risk; duplicate admin internship creation logic. Keep route paths stable, extract shared server/UI modules. |
| `components/employer/EmployerWorkspaceNav.tsx` + `components/admin/AdminSectionNav.tsx` + student page-local nav patterns | Separate role nav systems with independent matching/styling APIs. | `Merge` (under shared nav system) | Central objective: unified IA + shared rendering + role-aware filtering. |
| `app/dashboard/employer/new/page.tsx` wrapper around `app/dashboard/employer/page.tsx` | Delegates to main employer page with `createOnly`; route exists mainly as alias/state bootstrap. | `Keep` (for now) | Route path stability likely required; can stay thin wrapper while internals are consolidated. |
| `app/dashboard/student/page.tsx` legacy redirect | Pure alias route for old path. | `Keep` | Backward compatibility route; safe to keep unless links are fully migrated and deprecation planned. |
| `app/employer/page.tsx` redirect alias | Pure redirect to dashboard employer route. | `Keep` | Public/legacy entry alias likely intentional. |
| `app/dashboard/employer/_components/ApplicantsInboxGroup.tsx` | No imports/usages found in repo search. | `Delete` (after final reference verification) | Strong dead-code candidate; currently appears unreachable. |

---

## 4) Suspected Duplicate Route Handler Patterns

No exact duplicate `route.ts` files by hash, but there are likely consolidatable patterns:

- Search/normalize APIs repeat similar request parsing and validation structure across:
  - `/app/api/skills/search/route.ts`
  - `/app/api/skills/normalize/route.ts`
  - `/app/api/coursework/search/route.ts`
  - `/app/api/coursework/normalize/route.ts`
- Recommendation: `Merge` shared request helpers into `src/server`/`lib` modules while keeping current route paths.

---

## 5) Keep / Merge / Delete Summary

`Keep`:
- `app/dashboard/employer/new/page.tsx`
- `app/dashboard/student/page.tsx`
- `app/employer/page.tsx`
- Existing route paths (all role-facing URLs)

`Merge`:
- Role nav systems into a shared schema/selector/renderer
- Duplicate Catalog multi-select implementations
- Duplicate admin internship create/listing logic
- Common route handler plumbing for normalize/search endpoints

`Delete` (after verification in cleanup phase):
- `app/dashboard/employer/_components/ApplicantsInboxGroup.tsx` (currently appears unused)

---

## 6) Phase 1 Input Notes (for implementation)

- Canonical labels to standardize across roles where applicable:
  - `Dashboard`, `Applications`, `Listings`, `Inbox`, `Analytics`, `Settings`
- Primary vs secondary IA proposal:
  - Primary: role workspace sections (dashboard-level)
  - Secondary: page-level state tabs (e.g., applicants pipeline tabs, admin queue tabs)
- Active-state logic should move to one selector utility (pathname-based + exact/prefix matching) used by all role nav renderers.


---

## 7) Phase 1 Implementation Results (Navigation Unification)

Implemented shared navigation core:

- `src/navigation/navConfig.ts`
- `src/navigation/matchPath.ts`
- `src/navigation/getNavForRole.ts`
- `components/navigation/AppNav.tsx`

Refactored entry points to shared nav engine:

- `components/layout/SiteHeader.tsx`
  - role top-menu links now rendered via `AppNav` item overrides
  - active-state checks now use shared `matchPath`
  - existing auth/search/notification/profile behavior preserved
- `components/employer/EmployerWorkspaceNav.tsx`
  - now thin wrapper over `AppNav variant="workspaceTabs"`
  - preserves internship context query propagation and listing selector behavior
- `components/employer/EmployerDashboardHeader.tsx`
  - now delegates to workspace nav without `activeTab` prop coupling
- `app/dashboard/employer/messages/page.tsx`
  - now uses `EmployerDashboardHeader` for consistent workspace header/nav pattern
- `components/admin/AdminSectionNav.tsx`
  - now delegates to `AppNav variant="adminSidebar"`
- `app/student/dashboard/page.tsx`
- `app/student/dashboard/[section]/page.tsx`
  - added consistent student workspace nav using `AppNav`

Navigation consistency outcomes:

- One canonical nav schema + one canonical active matcher.
- Employer/admin/student workspace navigation now rendered through one shared renderer.
- Messages tab no longer bypasses employer dashboard header wrapper.

---

## 8) Phase 2 Implementation Results (Cleanup)

### 8A) Catalog multi-select merge

Merged duplicate implementations by using canonical:

- Canonical kept: `components/forms/CatalogMultiSelect.tsx`
- Repointed admin pages:
  - `app/admin/internships/page.tsx`
  - `app/admin/internships/new/page.tsx`
  - `app/admin/internships/[id]/page.tsx`
- Deleted duplicate:
  - `app/admin/internships/_components/CatalogMultiSelect.tsx`

### 8B) Admin internships duplication consolidation (safe extraction)

Kept both routes and extracted shared helper plumbing into:

- `app/admin/internships/_modules/sharedFormUtils.ts`

Both routes now consume shared helpers:

- `app/admin/internships/page.tsx`
- `app/admin/internships/new/page.tsx`

Notes:

- This is an incremental consolidation of duplicated parsing/normalization code.
- Full page-level decomposition (shared form/actions/query modules) remains a follow-up.

### 8C) Verified dead file removal

Deleted after no references found:

- `app/dashboard/employer/_components/ApplicantsInboxGroup.tsx`

### 8D) API route plumbing consolidation

Added shared API helper modules:

- `src/server/api/parseJson.ts`
- `src/server/api/validate.ts`
- `src/server/api/respond.ts`

Refactored routes to shared plumbing (response shapes preserved):

- `app/api/skills/search/route.ts`
- `app/api/skills/normalize/route.ts`
- `app/api/coursework/search/route.ts`
- `app/api/coursework/normalize/route.ts`

---

## 9) Verification

Build/typecheck status:

- `npm run build` passes after refactor.

Confirmed guardrails:

- URL paths unchanged for role dashboards and APIs.
- Employer internship context (`internship_id` propagation) preserved in workspace tabs.
- Admin layout still injects nav at `app/admin/layout.tsx`; renderer is now shared.

---

## 10) Remaining Follow-ups

- Complete deep consolidation of `app/admin/internships/page.tsx` and `app/admin/internships/new/page.tsx` into shared page modules (form/query/actions split).
- Optionally migrate secondary in-page tab systems (`components/admin/ListingsQueue.tsx`, `components/employer/inbox/EmployerApplicantsInboxClient.tsx`) onto shared tab primitives for full visual/API parity.
- If desired, fold `SiteHeader` left-side role links entirely into config-driven rendering to remove the last small branch-specific conditionals.

---

## 11) Subscription CTA Visibility + Profile Placement (Follow-up)

### Upgrade CTA rendering points (employer)

- `components/layout/SiteHeader.tsx`
  - `Upgrade` top-nav item now renders only when employer `planId` is resolved and not `pro`.
- `app/dashboard/employer/page.tsx`
  - free/starter upgrade modal is now gated by `plan.id !== 'pro'`.
- `app/dashboard/employer/_components/CreateInternshipCta.tsx`
  - at plan limit:
    - free/starter: keeps `Upgrade` CTA behavior
    - pro: removes `Upgrade` CTA and shows `Manage subscription` action instead

### Canonical max-plan guard

- Root layout now resolves employer plan via canonical billing status source:
  - `app/layout.tsx` uses `getEmployerVerificationStatus(...)` and passes `employerPlanId` to header shell.
- Guard rule used across header/dashboard CTA surfaces:
  - max tier is `planId === 'pro'`
  - when max tier, no employer `Upgrade` button is rendered.

### Manage Subscription location

- Employer account/profile area now includes a dedicated subscription panel:
  - `app/account/page.tsx` passes `createBillingPortalSessionAction` into employer account UI.
  - `components/account/EmployerAccount.tsx` renders:
    - plan label
    - subscription status label
    - `Manage subscription` button (server action to Stripe portal)

This keeps subscription management discoverable in profile/account while avoiding duplicate upgrade CTAs for Pro employers.

---

## 12) Verified Employer Badge Derivation Fix

- Badge source moved off listing snapshot data for runtime views.
- Canonical employer verification tier is now derived from current employer/subscription status and mapped onto listings at query/render time.

Updated paths:

- `lib/billing/subscriptions.ts`
  - added canonical helpers:
    - `resolveEmployerVerificationTier(...)`
    - `getEmployerVerificationTier(...)`
    - `getEmployerVerificationTiers(...)` (batched; avoids N+1)
- `lib/jobs/internships.ts`
  - `fetchInternships(...)` and `fetchInternshipsByIds(...)` now batch-resolve employer tiers and override `employer_verification_tier` in returned rows.
  - response shape remains unchanged (`employer_verification_tier` key preserved).
- `app/jobs/[id]/page.tsx`
  - detail page now derives employer tier from employer status and applies it to listing payload before rendering badge.
- `app/employers/[employerId]/page.tsx`
  - employer public profile badge now derives directly from employer status, not historical listing rows.
- `app/admin/listings-queue/page.tsx`
  - queue verification tier/quality scoring now uses derived employer tiers rather than listing snapshot values.

Outcome:

- Listings created before an upgrade now show the same current employer verification badge behavior as newly created listings.

Public exposure and RLS safety:

- Added read-only security-definer RPC for public/student-safe tier resolution:
  - `supabase/migrations/202602210002_public_employer_verification_tiers_rpc.sql`
  - function: `public.get_employer_listing_verification_tiers(target_user_ids uuid[])`
- Existing security-definer function remains used for single-employer derivation:
  - `public.resolve_employer_listing_verification_tier(target_user_id uuid)`
- No sensitive subscription/profile columns are exposed in payloads; only derived tier is returned and mapped back to existing `employer_verification_tier` response key.

Header polish:

- Top-nav "For Employers" button size now matches Sign in button height/typography baseline.
- Updated:
  - `components/navigation/AppNav.tsx` (`top` variant sizing)
  - `components/layout/SiteHeader.tsx` (sign-in button sizing)

---

## 13) Availability / Term Matching Normalization

Root cause addressed:

- Availability term mismatch was caused by non-canonical season mapping and single-season term parsing.
- Legacy month fallback incorrectly mapped `May` to `spring` in multiple flows.

Changes:

- Added canonical season normalization helpers:
  - `lib/availability/normalizeSeason.ts`
  - `lib/availability/seasonOverlap.ts`
- Updated matcher to use canonical season sets and overlap-based scoring:
  - `lib/matching.ts`
  - listing term ranges now map to multiple seasons (for example `March 2026 - June 2026` => `spring + summer`)
  - term alignment now uses partial overlap coverage instead of hard negative penalty
  - missing term data no longer creates misleading mismatch penalties
  - mismatch explanation now includes both sides:
    - `Term mismatch: listing is ..., you selected ...`
- Unified month fallback mapping (`May` => `summer`) in:
  - `components/jobs/JobsView.tsx`
  - `app/jobs/[id]/page.tsx`
  - `lib/applicationMatchSnapshot.ts`
  - `app/signup/student/details/page.tsx`
  - `lib/admin/matchingPreview.ts`
- Student profile UX nudge:
  - `components/account/StudentAccount.tsx` now includes `Winter` season option and helper text:
    - “Select all terms you are available to work.”

Tests:

- Added `tests/availability-season.test.ts` for canonical normalization + overlap + partial term scoring assertions.
