# MATCHING_SPEC.md

## Scope and Canonical Source
This spec defines the canonical matching system currently implemented in:
- `lib/matching.ts` (scoring + eligibility)
- `components/jobs/JobsView.tsx` (student feed ranking)
- `app/jobs/[id]/page.tsx` (detail explainability UI)
- `lib/applicationMatchSnapshot.ts` + `app/apply/[listingId]/page.tsx` + `app/jobs/_components/applyActions.ts` (apply-time snapshot persistence)

Matching version: `v1.1` (`MATCHING_VERSION` in `lib/matching.ts`).

## 1) Data Mapping

### 1.1 Internship fields -> student fields
| Match dimension | Internship source | Student source | Notes |
|---|---|---|---|
| Major/category alignment | `internships.majors`, `internships.role_category`, `internships.category` | `student_profiles.major_id -> canonical_majors.name` fallback `student_profiles.majors` | Major overlap first, then category text fallback. |
| Required skills | `internship_required_skill_items.skill_id` fallback `internships.required_skills` + `description` parsing | `student_skill_items.skill_id` fallback student text skills/coursework/majors | Canonical IDs first; text fallback if needed. |
| Preferred skills | `internship_preferred_skill_items.skill_id` fallback `internships.preferred_skills` + `description` parsing | `student_skill_items.skill_id` fallback student text skills/coursework/majors | Canonical IDs first. |
| Coursework alignment | `internship_coursework_category_links.category_id` + category name fallback `internship_coursework_items.coursework_item_id` fallback `internships.recommended_coursework` | `student_coursework_category_links.category_id` fallback `student_coursework_items.coursework_item_id` fallback `student_profiles.coursework` | Category-level matching is primary path. |
| Graduation year fit | `internships.target_graduation_years` | `student_profiles.year` | Hard gate when internship target years are present and student year is present. |
| Experience fit | `internships.target_student_year` fallback `internships.experience_level` | `student_profiles.experience_level` | Ordinal comparison. Hard gate if student below requirement. |
| Availability fit | `internships.hours_per_week` | `student_profiles.availability_hours_per_week` | Hard gate if internship hours exceed student availability. |
| Term fit | `internships.term` fallback `description` `Season:` parsing | `student_profiles.interests.preferred_terms` fallback `availability_start_month -> season` | Hard gate when both sides have term signals and mismatch. |
| Work mode fit | `internships.work_mode` fallback location suffix parse | `student_profiles.interests.preferred_work_modes`, `interests.remote_only` | Hard gate for remote-only vs in-person and explicit mode mismatch. |
| Location fit | `internships.location` (normalized text); jobs list also has `location_city/location_state` fields | `student_profiles.interests.preferred_locations` | Hard gate for in-person location mismatch when student has preferred locations. |

### 1.2 Canonical source tables/columns
- Majors:
  - `canonical_majors(id, slug, name)`
  - `student_profiles.major_id`
- Skills:
  - `skills(id, slug, label, category, normalized_name)`
  - `skill_aliases(alias, skill_id)`
  - `student_skill_items(student_id, skill_id)`
  - `internship_required_skill_items(internship_id, skill_id)`
  - `internship_preferred_skill_items(internship_id, skill_id)`
- Coursework items/categories:
  - `coursework_items(id, name, normalized_name)`
  - `coursework_categories(id, name, normalized_name)`
  - `student_coursework_items(student_id, coursework_item_id)`
  - `student_coursework_category_links(student_id, category_id)`
  - `internship_coursework_items(internship_id, coursework_item_id)`
  - `internship_coursework_category_links(internship_id, category_id)`
- Preferences + availability:
  - `student_profiles.interests` JSON (`preferred_terms`, `preferred_locations`, `preferred_work_modes`, `remote_only`, `skills`)
  - `student_profiles.availability_hours_per_week`
  - `student_profiles.availability_start_month`
- Internship timing/location/hours:
  - `internships.term`, `internships.work_mode`, `internships.location`, `internships.location_city`, `internships.location_state`, `internships.hours_per_week`, `internships.application_deadline`

## 2) Match Logic

### 2.1 Hard gates (eligibility)
Hard-fail (`eligible=false`) conditions in `evaluateInternshipMatch`:
1. Student `remote_only=true` and internship is `on-site` or `hybrid`.
2. Student has `preferred_work_modes`, and internship `work_mode` is not in that set.
3. Student has preferred terms and internship term season does not overlap.
4. `internship.hours_per_week > student.availability_hours_per_week` when both are present.
5. In-person internship + student has preferred locations + no location match.
6. Internship has `target_graduation_years` and student year is present but not included.
7. Internship required experience > student experience.

Pre-ranking fetch gate in `fetchInternships`:
- Only active listings (`internships.is_active = true`) and non-expired deadline (`application_deadline is null OR >= today`).

### 2.2 Weighted scoring model (canonical 0-100)
Implementation weights (`DEFAULT_MATCHING_WEIGHTS`):
- Required skills: `4.0`
- Preferred skills: `2.0`
- Coursework alignment: `1.5`
- Major/category alignment: `3.5`
- Graduation year: `1.5`
- Experience: `1.5`
- Availability: `2.0`
- Location/mode preference: `1.0`

Raw max = `17.0`.

Canonical normalized score:
- `normalized = raw_score / 17.0`
- `score_100 = round(normalized * 100)`

Where used:
- Feed ranking: raw score ordering (`rankInternships`).
- Job detail UI: displays 0-100 (`scoreToPercent`).
- Apply snapshot persistence: stores rounded raw integer in `applications.match_score`.

Rationale:
- Highest weight on hard-signal capability fit (required skills + major/category).
- Mid weights for availability and optional optimization signals.
- Lower weight for preference-only signal (`locationModePreference`) because strict mismatches are already gated.

### 2.3 Missing data handling
- Missing student signals do not hard-fail unless paired hard-gate condition is evaluable and violated.
- Missing internship optional signals simply contribute `0` for that dimension.
- Missing pay never affects score (pay is filter/UI only today).
- Missing canonical IDs triggers fallback cascade to text matching (skills/coursework/majors).
- If student profile is sparse, eligible roles still score on available dimensions.

### 2.4 Normalization rules
- Text normalization: trim, lowercase, collapse whitespace, unify `_`/`-` separators.
- Skills alias normalization: `normalizeSkills` resolves `skill_aliases.alias` -> `skills.id`, then `skills.slug`, then unknown.
- Skill label sanitization: rejects degree/qualification-like entries (`sanitizeSkillLabels`).
- Major normalization: canonical relation first (`major_id -> canonical_majors.name`), then parsed `majors` text.
- Coursework normalization: `normalizeCoursework` uses `coursework_items.normalized_name` token matching.
- Coursework category mapping from free text: `mapCourseworkTextToCategories` keyword mapping to `coursework_categories.normalized_name`.
- Work mode normalization: maps variants to `remote|hybrid|on-site`.
- Term normalization: mapped to seasons (`spring/summer/fall/winter`) including month-based fallback.
- City/state formatting in UI/query parsing: `City, ST` parsing with 2-letter uppercase state normalization.

## 3) Explainability

### 3.1 Top reasons (cards)
Current implementation:
- Feed cards show reasons only for top 3 best-match listings (`JobsView.tsx`), using lightweight heuristic reasons (major match, remote friendly, pay meets filter, availability fit).
- Reasons per card currently capped at 4 (`slice(0, 4)`).

Canonical audit policy:
- Card “Top reasons” should be max 3, highest-impact reasons first.
- Reason source should come from match explanation order when available.

### 3.2 Gaps
Current implementation:
- Full `match.gaps` list rendered on detail page (`app/jobs/[id]/page.tsx`), with CTA mappings (`Add skills`, `Update availability`, `Update preferences`).
- `applications.match_gaps` stored at apply time.

Canonical audit policy:
- Student card/list surfaces max 0 gaps.
- Detail/premium surfaces max 2 prioritized gaps.

### 3.3 UI copy strings (current)
Student-facing:
- Section title: `Why this match`
- Score label: `Match score` / `out of 100`
- Empty reasons: `No positive reasons yet.`
- Empty gaps: `No major gaps detected.`
- Gaps CTA labels: `Add skills`, `Update availability`, `Update preferences`

Employer-facing:
- Applicant sort label: `Best match`
- Reasons column: `Why this matches`
- Readiness labels: `High readiness`, `Baseline`
- Fit summary includes top reason when enabled.

## 4) Ranking Behavior

### 4.1 Default sort for signed-in students
- Default sort mode is `best_match` for student accounts.
- Non-students default to `newest`.

### 4.2 Filters vs ranking
- Filters are applied before ranking (`matchesListingFilters`).
- Matching ranks only the filtered candidate set.
- If sort is `newest`, matching score is not used for order.

### 4.3 Tie-breakers
Best-match sort in jobs feed:
1. Higher match score
2. Employer tier priority (`pro` priority placement boost)
3. Newer `created_at`

Newest sort:
1. Employer tier priority
2. Newer `created_at`

Audit note:
- Pay and distance are not currently tie-breakers in ranking.
- Distance is computed/displayed (`commuteMinutes`) but not used for ordering.

## 5) Premium vs Free Packaging (Students)

Current code state:
- No student subscription tier gating exists in matching surfaces today.
- All signed-in students can view detail-page score, reasons, and gaps.

Canonical packaging policy for audit:
- Free: label (`Best match`), useful 1-2 reasons, no penalty to core discovery.
- Premium: exact full breakdown (all signals), full reasons list, up to 2 actionable gaps with “improve your match” prompts.
- Free remains valuable by preserving ranking quality and core explainability.

Implementation note:
- This policy is not enforced in code yet; current plan gating exists for employer features only (`lib/billing/plan.ts`).

## 6) Employer View

How employers currently see match signals:
- Applicants inbox can sort by `match_score` (starter/pro only).
- Optional “Why this matches” reasons shown for top candidates when `matchReasons` feature is enabled.
- Readiness signal (`High readiness`/`Baseline`) enabled for pro.

What can be exported (current CSV):
- `application_id`, `internship_id`, `internship_title`, `student_id`, `created_at`, `status`, `resume_storage_path`, `external_apply_required`, `external_apply_completed_at`.
- Match score/reasons are not included in current CSV export route.

Assistive-not-decisive policy:
- Match is a prioritization aid only.
- UI and workflow still require employer review/status updates and manual notes.

## 7) Testing Plan

### 7.1 Ten test cases (mocked profiles + internships)
For each case, expected order is highest rank first among eligible listings.

1. Exact canonical skills + major + term fit
- Expect listing A > B where A has higher required skill overlap.

2. Required skills partial overlap
- Expect higher overlap ratio listing first; missing required skills appear as gap.

3. Coursework category beats coursework item fallback
- Expect category-overlap listing > item-only listing.

4. Remote-only student vs on-site internship
- On-site listing ineligible; remote listing ranked.

5. Work mode mismatch hard gate
- Student prefers hybrid only; remote listing excluded if no overlap.

6. Term mismatch hard gate
- Student prefers fall; summer listing excluded.

7. Hours exceed availability hard gate
- 35h internship excluded for 20h student.

8. Graduation year mismatch hard gate
- Target year list excludes student year -> ineligible.

9. Experience mismatch hard gate
- Internship requires junior-level equivalent; freshman-level profile ineligible.

10. Tie score ordering
- Equal match score listings ordered by employer tier priority, then created_at desc.

### 7.2 Edge cases to include
- Remote-only student with missing preferred locations.
- Student with missing major but strong canonical skill/category overlap.
- Internship with missing pay fields.
- Internship with mismatched location/work mode strings requiring normalization.
- Partial skills on both sides with canonical IDs absent (text fallback path).

### 7.3 Manual QA checklist
1. Verify expired internships never appear in jobs feed.
2. Verify student default sort is `best_match`.
3. Verify hard-gated listings are excluded, not merely down-ranked.
4. Verify detail page score equals normalized formula from raw score.
5. Verify reasons are sorted by points contribution.
6. Verify gaps include actionable CTA links when recognized.
7. Verify apply snapshot persists `match_score`, `match_reasons`, `match_gaps`, `matching_version`.
8. Verify employer free/starter/pro feature gates on applicants inbox.
9. Verify ranking tie-break behavior for equal scores.
10. Verify analytics events fire for view/apply/click paths.

## 8) Implementation Notes

### 8.1 Where scoring runs
- Server-side in Next.js routes/components:
  - Jobs feed ranking (`components/jobs/JobsView.tsx` -> `rankInternships`).
  - Job detail explainability (`app/jobs/[id]/page.tsx` -> `evaluateInternshipMatch`).
  - Apply-time snapshot (`lib/applicationMatchSnapshot.ts`).
- Not executed on client for authoritative ranking.

### 8.2 Performance considerations
- Feed fetch limits (default 60/page, capped 120) and then in-memory match ranking.
- Match function is O(n) per listing with small set intersections; canonical IDs reduce expensive text comparisons.
- Schema-tolerant query fallback in `fetchInternships` protects during partial migrations.
- Commute calculations are separate and do not affect match rank.

### 8.3 Event logging points
Tracked now:
- Listing/detail exposure and apply funnel events via `trackAnalyticsEvent`:
  - `view_job_detail`, `apply_click`, `submit_apply_success`, `quick_apply_submitted`, `external_apply_clicked`, `external_apply_completed`, `apply_blocked`.
- Stored in `analytics_events`; mapped view/click/apply events also written to `internship_events` when listing id exists.

Not currently logged as first-class events:
- Ranked-list exposure payloads (e.g., which listing IDs were shown at which rank/score).

## Audit Deltas (Requested vs Current)
- Requested top reasons max 3: current card path may show up to 4 reasons.
- Requested gaps max 2 in premium/detail: current detail shows full gaps list.
- Requested tie-breakers include pay/distance: current implementation uses score -> employer tier -> recency; pay/distance are not ranking tie-breakers.
- Remote eligibility scope/state fields exist (`remote_eligibility_scope`, `remote_eligible_states`) but are not yet used as hard gates in scoring.
