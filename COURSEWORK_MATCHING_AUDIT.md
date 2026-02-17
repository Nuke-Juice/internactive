# COURSEWORK_MATCHING_AUDIT

## 1) Executive Summary

### What exists today (high-level)
The current coursework-to-match stack is a hybrid of two systems:
- Legacy coursework taxonomy path: `coursework_items` / `coursework_categories` / `student_coursework_*` / `internship_coursework_*`, used directly by ranking in `lib/matching.ts`.
- New canonical catalog path: `canonical_courses` / `student_courses` / `canonical_course_categories` / `internship_required_course_categories`, used by UI/search/edit flows but mostly not consumed by ranking.

Core matching runs in `lib/matching.ts` (`MATCHING_VERSION = 'v1.2'`), primarily in server-side rendering/actions (`components/jobs/JobsView.tsx`, `app/jobs/[id]/page.tsx`, `lib/applicationMatchSnapshot.ts`, application submit actions).

### What’s working
- Ranking pipeline is deterministic and explainable (`score`, `reasons`, `gaps`, optional per-signal breakdown).
- Canonical skill/category IDs are supported first, with text fallback.
- Match snapshot persistence is implemented at apply-time via RPC `submit_application_with_cap` and stores `applications.match_score`, `match_reasons`, `match_gaps`, `matching_version`.
- Course catalog search endpoint supports school-scoped suggestions and DB-backed search (`app/api/coursework/search/route.ts`).

### What’s broken/risky (especially cross-school comparability)
- **Critical model split:** employer listing workflow saves required course categories to `internship_required_course_categories` (new canonical model), but ranking reads `internship_coursework_category_links` (legacy model). This disconnect means coursework requirements from employer listing forms often do not affect rank score.
- **Cross-school canonical courses are mostly not used in scoring:** `student_courses` and `canonical_courses` are written/read in profile flows, but matching itself does not read `student_courses`.
- **No institution equivalency/crosswalk layer:** no table/function for BYU/Utah/USU course equivalencies or canonical cross-school groups was found.
- **Ingestion inconsistency:** `data/university-course-catalog.generated.json` has empty BYU/Utah/USU arrays (HTTP 405 in source crawl), while `data/university-course-catalog.manual.json` contains verbose text entries that are not clean canonical course labels.
- **Unverified/custom coursework handling is inconsistent:** signup tracks unverified coursework in client state but does not persist `student_profiles.coursework_unverified` (column exists, unused).

### Top 5 highest-impact next changes (recommendations only)
1. Unify coursework matching input to one canonical requirement source and wire `internship_required_course_categories` into ranking inputs.
2. Add a minimal cross-school canonical layer (course group + aliases/equivalencies) and make scoring consume it.
3. Make `student_courses` a first-class scoring input (before text fallback) and treat `student_profiles.coursework` as fallback only.
4. Formalize normalization rules for subject and level bands across institutions (including 3-digit/4-digit number conversion logic).
5. Persist and safely gate unverified/custom coursework (`coursework_unverified`) as lower-confidence signals.

---

## 2) System Map (End-to-End)

### Pipeline
- Course catalog ingestion/storage:
  - CSV normalization/import tooling writes canonical payloads (`scripts/import-course-csvs.mjs`, `scripts/seed-canonical-courses-from-csv.mjs`) into `canonical_courses` (+ `canonical_course_categories`).
  - Search API reads `canonical_courses` plus university-scoped local JSON catalogs (`app/api/coursework/search/route.ts`, `lib/coursework/universityCourseCatalog.ts`).
- Student course selection/storage (verified vs custom/unverified):
  - Signup/account UIs collect coursework (`app/signup/student/details/page.tsx`, `components/account/StudentAccount.tsx`).
  - Verified text is normalized to `coursework_items` IDs (`/api/coursework/normalize`) and category links (`/api/coursework/map-categories`).
  - Writes: `student_coursework_items`, `student_coursework_category_links`, `student_courses`, and sometimes text `student_profiles.coursework`.
  - `student_profiles.coursework_unverified` exists in schema migration but is not written by current code.
- Employer listing course requirements:
  - Employer dashboard form writes selected required categories to `internship_required_course_categories` (`app/dashboard/employer/page.tsx`).
  - Admin listing pages still write legacy `internship_coursework_items` and `internship_coursework_category_links`.
- Matching pipeline (where called, when computed, where stored):
  - Jobs ranking: `rankInternships(...)` in `components/jobs/JobsView.tsx` at page render when student sorts by `best_match`.
  - Job detail explainability: `evaluateInternshipMatch(...)` in `app/jobs/[id]/page.tsx` at render.
  - Apply snapshot: `buildApplicationMatchSnapshot(...)` in `app/apply/[listingId]/page.tsx` and `app/jobs/_components/applyActions.ts`; stored via RPC `submit_application_with_cap` into `applications`.
- How match scores are surfaced in UI:
  - Student jobs: “Why this matches” reasons + job detail score/gaps.
  - Applications/inbox/employer applicants/admin applicants: reads `applications.match_score` and `match_reasons` for sorting/display.

---

## 3) Database Inventory (actual schema, not guesses)

### Scope note
- `supabase/exports/remote_schema.sql` is empty in this repo, so inventory is from migrations and direct code references.
- `create table` statements for `student_profiles`, `internships`, `applications`, `users` were **not found** in current migration set; only alters/policies are present.

### Coursework & catalog tables

#### `public.canonical_course_categories`
- Purpose: canonical requirement categories for listings/catalog.
- Key columns: `id` (PK), `slug` (unique), `name`, `created_at`.
- Indexes/constraints: unique `slug`.
- RLS: enabled; select public policy exists (`canonical_course_categories_select_public`).
- Source: `supabase/migrations/202602140001_employer_internship_structured_matching_refactor.sql`.

#### `public.canonical_courses`
- Purpose: canonical course catalog rows (institution + subject/number/title).
- Key columns: `id` (PK), legacy `code`, `name`, `category_id` FK -> `canonical_course_categories.id`, `level`; later `subject_code`, `course_number`, `title`, `institution`, `category`, `slug`.
- Indexes/constraints:
  - `canonical_courses_level_check` (`intro|intermediate|advanced`).
  - unique `slug` (`canonical_courses_slug_key`).
  - indexes on `subject_code`, `course_number`, `institution`, `slug`, plus `category_id`.
  - legacy unique `(code, category_id)` dropped in later migration.
- RLS: enabled; select public policy (`canonical_courses_select_public`).
- Source: `supabase/migrations/202602140001_employer_internship_structured_matching_refactor.sql`, `supabase/migrations/202602150006_align_canonical_courses_csv_catalog.sql`.

#### `public.student_courses`
- Purpose: student links to canonical course IDs.
- Key columns: PK (`student_profile_id`, `course_id`); FK `student_profile_id` -> `users.id`; FK `course_id` -> `canonical_courses.id`.
- Indexes: `student_courses_student_profile_id_idx`, `student_courses_course_id_idx`.
- RLS: enabled; own-select/insert/delete policies.
- Source: `supabase/migrations/202602140001_employer_internship_structured_matching_refactor.sql`.

#### `public.internship_required_course_categories`
- Purpose: employer-selected required canonical course categories for internship listing.
- Key columns: PK (`internship_id`, `category_id`), FK -> `internships.id`, FK -> `canonical_course_categories.id`, `created_at`.
- Indexes: `internship_required_course_categories_category_id_idx`.
- RLS: enabled; select public; insert/delete by owning employer policies.
- Source: `supabase/migrations/202602140001_employer_internship_structured_matching_refactor.sql`.

#### `public.coursework_items`
- Purpose: legacy normalized coursework item catalog.
- Key columns: `id` (PK), `name`, `normalized_name` (unique), `created_at`.
- Indexes: unique via column constraint on `normalized_name`; trigram index on `name` added later.
- RLS: enabled; select public, insert admin.
- Source: `supabase/migrations/202602090010_canonical_coursework_and_catalog_policies.sql`, `supabase/migrations/202602090011_coursework_categories_taxonomy.sql`.

#### `public.student_coursework_items`
- Purpose: student links to legacy coursework items.
- Key columns: PK (`student_id`, `coursework_item_id`), FK -> `users.id`, FK -> `coursework_items.id`.
- Indexes: `student_coursework_items_coursework_item_id_idx`.
- RLS: enabled; own-select/insert/delete policies.
- Source: `supabase/migrations/202602090010_canonical_coursework_and_catalog_policies.sql`.

#### `public.internship_coursework_items`
- Purpose: internship links to legacy coursework items.
- Key columns: PK (`internship_id`, `coursework_item_id`), FK -> `internships.id`, FK -> `coursework_items.id`.
- Indexes: `internship_coursework_items_coursework_item_id_idx`.
- RLS: enabled; select public; insert/delete by employer or admin (policy refactor in lint cleanup).
- Source: `supabase/migrations/202602090010_canonical_coursework_and_catalog_policies.sql`, `supabase/migrations/202602100007_supabase_lint_cleanup.sql`.

#### `public.coursework_categories`
- Purpose: legacy coursework category taxonomy used by current ranking inputs.
- Key columns: `id` (PK), `name`, `normalized_name` (unique), `created_at`.
- Indexes: trigram index on `name`.
- RLS: enabled; select public; admin insert/update/delete.
- Source: `supabase/migrations/202602090011_coursework_categories_taxonomy.sql`, `supabase/migrations/202602100007_supabase_lint_cleanup.sql`.

#### `public.coursework_item_category_map`
- Purpose: mapping from legacy coursework items -> legacy categories.
- Key columns: PK (`coursework_item_id`, `category_id`), FK -> `coursework_items.id`, FK -> `coursework_categories.id`.
- Indexes: `coursework_item_category_map_category_idx`.
- RLS: enabled; select public; admin insert/update/delete.
- Source: `supabase/migrations/202602090011_coursework_categories_taxonomy.sql`, `supabase/migrations/202602100007_supabase_lint_cleanup.sql`.

#### `public.student_coursework_category_links`
- Purpose: student links to legacy coursework categories.
- Key columns: PK (`student_id`, `category_id`), FK -> `users.id`, FK -> `coursework_categories.id`.
- Indexes: `student_coursework_category_links_category_idx`.
- RLS: enabled; own-select/insert/delete policies.
- Source: `supabase/migrations/202602090011_coursework_categories_taxonomy.sql`.

#### `public.internship_coursework_category_links`
- Purpose: internship links to legacy coursework categories.
- Key columns: PK (`internship_id`, `category_id`), FK -> `internships.id`, FK -> `coursework_categories.id`.
- Indexes: `internship_coursework_category_links_category_idx`.
- RLS: enabled; select public; insert/delete by employer or admin (policy refactor in lint cleanup).
- Source: `supabase/migrations/202602090011_coursework_categories_taxonomy.sql`, `supabase/migrations/202602100007_supabase_lint_cleanup.sql`.

### Core profile/listing/application tables (relevant columns observed)

#### `public.student_profiles` (create-table not found in migrations)
- Purpose: student matching/profile text store.
- Relevant columns observed in code/migrations: `user_id`, `school`, `university_id`, `major_id`, `second_major_id`, `majors`, `year`, `coursework`, `coursework_unverified`, `experience_level`, `availability_start_month`, `availability_hours_per_week`, `interests`, `preferred_city/state/zip`, commute/location fields.
- RLS notes: policies in `supabase/rls_policies.sql` show own-select and own-update.
- Evidence:
  - Alter add `second_major_id`, `coursework_unverified`: `supabase/migrations/202602150005_student_profiles_second_major_and_custom_coursework.sql`.
  - Direct code selects/updates: `components/account/StudentAccount.tsx`, `app/signup/student/details/page.tsx`, `components/jobs/JobsView.tsx`.

#### `public.internships` (create-table not found in migrations)
- Purpose: listing source of match inputs.
- Relevant columns observed in migrations/code: `recommended_coursework`, `desired_coursework_strength`, `target_graduation_years`, `target_student_year`, `required_skills`, `preferred_skills`, `work_mode`, `term`, `hours_*`, location fields, application cap fields.
- RLS notes: public select + employer owner write in `supabase/rls_policies.sql`.
- Evidence: multiple alter migrations and all listing read/write code paths.

#### `public.applications` (create-table not found in migrations)
- Purpose: persisted apply snapshots including match score and explanations.
- Relevant columns from migration: `match_score`, `match_reasons`, `match_gaps`, `matching_version`, `matched_at`, `submitted_at`, `employer_viewed_at`.
- Indexes: internship/status/submitted_at, student/submitted_at, employer_viewed_at.
- RLS notes: student insert/select own, employer select/update for own internships (`supabase/rls_policies.sql`).
- Source: `supabase/migrations/202602080003_application_match_snapshot.sql`, `supabase/migrations/202602150001_applicant_cap_transparency.sql`.

### Views/functions relevant to matching persistence

#### Function `public.submit_application_with_cap(...)`
- Purpose: transaction-safe apply insert/update with cap checks and match snapshot persistence.
- Writes: `applications.match_score`, `match_reasons`, `match_gaps`, `matching_version`.
- Security: `security definer`, execute granted to authenticated.
- Source: `supabase/migrations/202602150001_applicant_cap_transparency.sql`.

#### Function `public.recompute_internship_applications_count(...)` + trigger fn
- Purpose: maintains `internships.applications_count`; indirectly affects apply gating.
- Source: `supabase/migrations/202602150001_applicant_cap_transparency.sql`.

#### Function `public.is_admin_user(uid)`
- Purpose: admin RLS policy helper for coursework tables.
- Source: `supabase/migrations/202602090010_canonical_coursework_and_catalog_policies.sql` (replaced in taxonomy migration too).

#### View `public.employer_response_rate_stats`
- Purpose: response-rate analytics view; not used in match score computation.
- Source: `supabase/migrations/202602150001_applicant_cap_transparency.sql`.

---

## 4) Code Inventory (actual call sites)

### Student coursework is read
- `components/jobs/JobsView.tsx` -> `JobsView(...)`
  - Reads `student_profiles.coursework`, `student_coursework_items`, `student_coursework_category_links` for ranking profile.
- `app/jobs/[id]/page.tsx` -> default page function
  - Reads `student_profiles.coursework`, `student_coursework_items`, `student_coursework_category_links` for detail-page match breakdown.
- `app/apply/[listingId]/page.tsx` -> `submitApplication(...)`
  - Reads `student_profiles` and `student_coursework_category_links` for apply snapshot.
- `app/jobs/_components/applyActions.ts` -> `applyFromMicroOnboardingAction(...)`
  - Reads `student_profiles` and `student_coursework_category_links` for apply snapshot.
- `components/account/StudentAccount.tsx` -> `loadLatestProfile()`
  - Reads profile text coursework + canonical/item/category links.
- `app/signup/student/details/page.tsx` -> `initializePage()`
  - Reads `student_courses` (joined to `canonical_courses`) for prefill.

### Listing requirements are read
- `lib/jobs/internships.ts` -> `fetchInternships(...)`, `fetchInternshipsByIds(...)`
  - Selects `internship_coursework_items`, `internship_coursework_category_links` (legacy matching tables).
- `components/jobs/JobsView.tsx`
  - Passes listing `coursework_item_ids`, `coursework_category_ids`, `coursework_category_names` into `rankInternships`.
- `app/jobs/[id]/page.tsx`
  - Reads listing `internship_coursework_*` and feeds `evaluateInternshipMatch`.
- `app/apply/[listingId]/page.tsx` / `app/jobs/_components/applyActions.ts`
  - Reads listing `internship_coursework_category_links` for snapshot.
- `app/dashboard/employer/page.tsx`
  - Reads/writes `internship_required_course_categories` (canonical categories) for listing form.

### Matching score is computed
- `lib/matching.ts`
  - `evaluateInternshipMatch(...)` computes score/reasons/gaps.
  - `rankInternships(...)` ranks and filters eligible listings.
- Call sites:
  - `components/jobs/JobsView.tsx` (`rankInternships`).
  - `app/jobs/[id]/page.tsx` (`evaluateInternshipMatch`).
  - `lib/applicationMatchSnapshot.ts` (`evaluateInternshipMatch` at apply-time).
  - `lib/admin/matchingPreview.ts` (`rankInternships`, `evaluateInternshipMatch`, explain mode).

### Match explanations are generated
- `lib/matching.ts` in `evaluateInternshipMatch(...)` and `finalizeMatchResult(...)`:
  - Generates `reasons`, `gaps`, and optional `breakdown` when `explain: true`.
- Surfaced in:
  - `app/jobs/_components/JobCard.tsx` (“Why this matches”).
  - `app/jobs/[id]/page.tsx` (score/reasons/gaps).
  - `app/admin/matching/preview/page.tsx` (per-signal breakdown).
  - persisted to `applications.match_reasons` at apply.

### Data is written back (cache/snapshots/server actions)
- Student coursework writes:
  - `app/signup/student/details/page.tsx` -> `saveProfileDetails()` writes `student_coursework_items`, `student_courses`, `student_coursework_category_links`, `student_profiles`.
  - `components/account/StudentAccount.tsx` -> `saveProfile()` writes same tables + `student_profiles`.
- Listing requirement writes:
  - `app/dashboard/employer/page.tsx` -> `createInternship(...)` writes `internship_required_course_categories`.
  - Admin listing pages (`app/admin/internships/new/page.tsx`, `app/admin/internships/page.tsx`, `app/admin/internships/[id]/page.tsx`) write legacy `internship_coursework_items` + `internship_coursework_category_links`.
- Match snapshot writes:
  - `app/apply/[listingId]/page.tsx` and `app/jobs/_components/applyActions.ts` call RPC `submit_application_with_cap` with `in_match_score`, `in_match_reasons`, `in_match_gaps`, `in_matching_version`.

---

## 5) Classification Audit (BYU/Utah/USU comparability)

### How courses are classified today
- School/institution:
  - Catalog side: `canonical_courses.institution`.
  - Student profile side: `student_profiles.school` (free text/selected school name).
- Subject/department:
  - `canonical_courses.subject_code` (e.g., `ACCTG`, `ACC`, `ACCT`, `FINAN`, `FIN`).
- Course number/level normalization:
  - `canonical_courses.course_number` is text.
  - CSV seed infers `level` from number (`<3000` intro, `<5000` intermediate, else advanced) in `scripts/seed-canonical-courses-from-csv.mjs`.
  - Matching code currently does **not** use `course_number` or `level`.
- Duplicates/aliases/equivalencies:
  - Ingestion dedupe key is institution+subject+number (`dedupe_key` in import JSONL tooling).
  - Query-time alias logic in search route only handles `ACC` <-> `ACCTG` string alias (`app/api/coursework/search/route.ts`).
  - No cross-school course equivalency table/crosswalk found (`canonical_course_groups`, equivalency maps, alias tables for courses: **Not found** by `rg` search).

### What prevents reliable comparison right now
- No shared canonical cross-school course concept beyond raw `(institution, subject_code, course_number)`.
- Matching ignores `student_courses`/`canonical_courses`; it mostly uses legacy category links or text overlap.
- Employer “required coursework categories” are saved in `internship_required_course_categories` but current ranking path uses legacy `internship_coursework_category_links`.
- BYU/Utah/USU generated crawler source is empty in `data/university-course-catalog.generated.json`; manual file contains noisy/descriptive rows not normalized to strict code-title format.

### Concrete inconsistencies observed
- Subject code drift for same domain: `ACCTG` vs `ACC` vs `ACCT`; `FINAN` vs `FIN`.
- Numbering format drift: BYU commonly 3-digit (e.g., `FIN 201`), Utah/USU commonly 4-digit (e.g., `FINAN 3040`, `FIN 3200`).
- Manual catalog rows often include long descriptions in place of clean titles (e.g., `"ACCTG 2600 ..."` text fragments).
- Import file shows repeated same BYU subject+number with different titles collapsed under one dedupe key (e.g., `BYU:CMLIT:420R` appears multiple times in `data/course_import/byu.normalized.jsonl`).

### Minimal canonical layer recommendation (concept only)
- Add `canonical_course_groups` (one row = cross-school equivalent concept).
- Add `canonical_course_aliases` (institution+subject+number/title variants -> group id).
- Add `canonical_subjects` + `canonical_subject_aliases` (e.g., ACCT/ACCTG/ACC -> Accounting).
- Add deterministic level band normalization from `course_number` into explicit comparable bands (1000/2000/3000/4000+ and grad).
- Keep source rows immutable and map through aliases/crosswalk during ranking.

---

## 6) Quantification Audit (impact on match scores)

### How coursework affects score today (real code)
- In `lib/matching.ts`, coursework contributes via signal `courseworkAlignment` with default weight `2`.
- Total max raw score = `17.5`, so coursework max influence is about **11.4%** of total.
- Priority order:
  1. Category-ID overlap (`required_course_category_ids` + `coursework_category_ids` vs student `coursework_category_ids`).
  2. Coursework item ID overlap (`coursework_item_ids` vs student `coursework_item_ids`).
  3. Text overlap (`recommended_coursework` vs student `coursework`).
- Strength handling:
  - `desired_coursework_strength` maps to minimum expected hits: low=1, medium=3, high=5.
  - Score uses `max(categoryRatio, strengthRatio)` for category path.

### How unverified/custom courses are handled
- Signup flow tracks verified/unverified in client state but only normalized verified list is mapped to canonical tables; unverified persistence column (`coursework_unverified`) is not used.
- Account page stores text coursework in `student_profiles.coursework`; unknown items remain as fallback text and can still influence text-overlap matching.
- Net effect: unverified/custom items can affect score only through text fallback, not canonical ID overlap.

### Signal strength vs other dimensions
- Higher-weight signals than coursework:
  - required skills `4`, major/category alignment `3`.
- Same/lower neighborhood:
  - preferred skills `2`, availability `2`, experience `1.5`, term/location/start-date preference signals `1` each.
- Hard eligibility filters can bypass score entirely (deadline, remote-only mismatch, hours exceed availability, strict mismatch flags, grad year mismatch, experience mismatch).

### Where computed and when
- Server-side, at request/action time:
  - Jobs list render (`components/jobs/JobsView.tsx`), job detail render (`app/jobs/[id]/page.tsx`), apply submission snapshot (`lib/applicationMatchSnapshot.ts` in apply actions).
- Persisted snapshot:
  - At apply only, to `applications` via RPC.

### Minimal scoring rubric recommendation (concept only)
- Signals:
  - Canonical required-course-group hits (highest coursework confidence).
  - Subject/domain overlap (medium confidence).
  - Level alignment bonus (e.g., advanced coursework for advanced-role categories).
  - Optional text fallback (low confidence).
- Relative ranges:
  - Required canonical coursework/group hits: high (similar magnitude to required skills).
  - Subject/domain overlap: medium.
  - Level bonus: low-medium.
  - Text fallback: low.
- Safe unverified handling:
  - Keep unverified/custom text as optional low-weight additive signal only.
  - Never use unverified entries for hard filters.
  - Display confidence tier in explanation output.

---

## 7) Gaps / Bugs / Risks

### Schema-cache mismatch patterns
- `lib/jobs/internships.ts` has explicit “missing column” fallback query logic (`runSchemaTolerantInternshipQuery`) that drops columns dynamically on `does not exist` errors; this masks schema drift at runtime.
- `components/account/StudentAccount.tsx` upsert fallback permutations (`includeUniversityId` / `includePreferences`) indicate live schema variation tolerance.

### Legacy/new model mismatch still referenced
- Employer listing form writes `internship_required_course_categories` (new canonical categories).
- Matching read paths use `internship_coursework_category_links` / `internship_coursework_items` (legacy categories/items).
- `student_courses` (new canonical courses) is not read by matching pipeline.

### Potential RLS footguns
- Coursework tables are generally scoped correctly (own rows for student links; public reads for catalog/category).
- `submit_application_with_cap` is `security definer`; logic checks `auth.uid()`/ownership and is appropriate, but all policy bypass is concentrated there.
- `internships` public select and coursework category link public select mean listing requirements are publicly visible by design.

### Silent failure paths
- If neither side has coursework category/item IDs and text overlap is empty, coursework contributes 0 with no explicit gap message.
- If employer only configured `internship_required_course_categories`, current ranking paths may treat coursework as absent because those IDs are not wired into ranking inputs.
- Signup flow collects unverified coursework but does not persist `coursework_unverified`, silently discarding that distinction.
- Validation enums include required coursework/skills/year checks, but current `validateListingForPublish` and `validateInternshipInput` implementations do not enforce all declared checks.

---

## 8) Queries Appendix (READ-ONLY)

### A) Show a student’s coursework (verified canonical links + text fallback)
```sql
-- :student_id is UUID
select
  sp.user_id,
  sp.school,
  sp.coursework as coursework_text,
  sp.coursework_unverified,
  sc.course_id,
  cc.institution,
  cc.subject_code,
  cc.course_number,
  cc.title,
  sci.coursework_item_id,
  cwi.name as coursework_item_name,
  scc.category_id,
  ccat.name as coursework_category_name
from public.student_profiles sp
left join public.student_courses sc
  on sc.student_profile_id = sp.user_id
left join public.canonical_courses cc
  on cc.id = sc.course_id
left join public.student_coursework_items sci
  on sci.student_id = sp.user_id
left join public.coursework_items cwi
  on cwi.id = sci.coursework_item_id
left join public.student_coursework_category_links scc
  on scc.student_id = sp.user_id
left join public.coursework_categories ccat
  on ccat.id = scc.category_id
where sp.user_id = :student_id;
```

### B) Show listing course requirements from both models
```sql
-- :internship_id is UUID
select
  i.id as internship_id,
  i.title,
  i.recommended_coursework,
  i.desired_coursework_strength,
  ircc.category_id as required_canonical_category_id,
  ccc.name as required_canonical_category_name,
  icl.category_id as legacy_category_id,
  lc.name as legacy_category_name,
  ici.coursework_item_id as legacy_coursework_item_id,
  cwi.name as legacy_coursework_item_name
from public.internships i
left join public.internship_required_course_categories ircc
  on ircc.internship_id = i.id
left join public.canonical_course_categories ccc
  on ccc.id = ircc.category_id
left join public.internship_coursework_category_links icl
  on icl.internship_id = i.id
left join public.coursework_categories lc
  on lc.id = icl.category_id
left join public.internship_coursework_items ici
  on ici.internship_id = i.id
left join public.coursework_items cwi
  on cwi.id = ici.coursework_item_id
where i.id = :internship_id;
```

### C) Show likely match-score inputs for one student + one listing
```sql
-- :student_id and :internship_id are UUIDs
select
  i.id as internship_id,
  i.title,
  i.required_skills,
  i.preferred_skills,
  i.recommended_coursework,
  i.desired_coursework_strength,
  i.target_graduation_years,
  i.target_student_year,
  i.work_mode,
  i.term,
  i.hours_per_week,
  sp.user_id as student_id,
  sp.majors,
  sp.year,
  sp.experience_level,
  sp.coursework,
  sp.availability_hours_per_week,
  sp.availability_start_month,
  array_agg(distinct ssc.category_id) filter (where ssc.category_id is not null) as student_coursework_category_ids,
  array_agg(distinct isc.category_id) filter (where isc.category_id is not null) as internship_legacy_coursework_category_ids,
  array_agg(distinct ircc.category_id) filter (where ircc.category_id is not null) as internship_required_canonical_category_ids
from public.internships i
join public.student_profiles sp on sp.user_id = :student_id
left join public.student_coursework_category_links ssc on ssc.student_id = sp.user_id
left join public.internship_coursework_category_links isc on isc.internship_id = i.id
left join public.internship_required_course_categories ircc on ircc.internship_id = i.id
where i.id = :internship_id
group by i.id, sp.user_id;
```

### D) Show duplicates by normalized course key (school + subject + number)
```sql
select
  institution,
  upper(coalesce(subject_code, '')) as subject_code,
  upper(coalesce(course_number, '')) as course_number,
  count(*) as row_count,
  array_agg(id order by id) as sample_ids,
  array_agg(coalesce(title, name) order by coalesce(title, name)) as sample_titles
from public.canonical_courses
where institution is not null
  and subject_code is not null
  and course_number is not null
group by institution, upper(coalesce(subject_code, '')), upper(coalesce(course_number, ''))
having count(*) > 1
order by row_count desc, institution, subject_code, course_number;
```

### E) Show cross-school same subject+number collisions (possible equivalency candidates)
```sql
select
  upper(coalesce(subject_code, '')) as subject_code,
  upper(coalesce(course_number, '')) as course_number,
  count(distinct institution) as institution_count,
  array_agg(distinct institution order by institution) as institutions,
  count(*) as total_rows
from public.canonical_courses
where subject_code is not null
  and course_number is not null
  and institution is not null
group by upper(coalesce(subject_code, '')), upper(coalesce(course_number, ''))
having count(distinct institution) > 1
order by institution_count desc, total_rows desc, subject_code, course_number;
```

---

## Next Steps (conceptual)
- Align listing requirement writes/reads so one coursework requirement model feeds ranking.
- Introduce canonical cross-school course grouping and subject alias mapping.
- Promote canonical course IDs/categories to primary scoring signals, text fallback secondary.
- Add explicit observability checks for “coursework signal absent due to model mismatch.”
