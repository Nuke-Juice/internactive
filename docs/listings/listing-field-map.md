# Listing Field Map

Source of truth: `public.internships` (Supabase/Postgres).

This map is used as the checklist for:
- Employer self-serve create/edit (`/dashboard/employer`)
- Concierge/admin create/edit (`/admin/internships/new`, `/admin/internships/[id]`)

## Required For Publish

| Field | Type | Null | Default | Why it matters |
|---|---|---|---|---|
| `title` | `text` | nullable in DB, required by app | none | Listing headline shown on card/details |
| `employer_id` | `uuid` | non-null | none | Ownership + RLS + company join |
| `work_mode` | `text` | non-null (aligned migration) | `hybrid` | Card chips, matching, commute logic |
| `hours_min` | `integer` | nullable in DB, required by app publish | none | Card hours/week display + filtering |
| `hours_max` | `integer` | nullable in DB, required by app publish | none | Card hours/week display + filtering |
| `pay` OR (`pay_min_hourly`/`pay_max_hourly`) | `text` / `numeric` | nullable in DB, required by app publish | none | Card pay display |
| `term` | `text` | nullable in DB, required by app publish | none | Card/details timeframe + matching |
| `majors` | `text` or `text[]` (legacy mixed usage) | nullable in DB, required by app publish | none | Matching + card/details “Majors” |
| `short_summary` | `text` | nullable in DB, required by app publish | none | 1-line card preview |
| `description` | `text` | nullable in DB, required by app publish | none | Details page + card fallback preview |

## Required Conditionally

| Field | Rule |
|---|---|
| `location_city`, `location_state` | required when `work_mode` is `on-site` or `hybrid` |
| `remote_eligibility` | optional, only relevant when `work_mode = remote` |

## Recommended

| Field | Type | Notes |
|---|---|---|
| `application_deadline` / `apply_deadline` | `date` | Supports “Closes in X days” and urgency UI |
| `experience_level` | `text` enum-like | Entry/mid/senior mapping on cards |
| `category`, `role_category` | `text` | Search/filter and secondary metadata |
| `required_skills`, `preferred_skills` | `text[]` | Matching/scoring and card skill chips |
| `target_graduation_years` | `text[]` | Matching and recruiter targeting |
| `responsibilities`, `qualifications` | `text[]` | Rich details on admin/editorial workflows |
| `employment_type`, `internship_types` | `text`, `text[]` | Captures part-time/full-time plus fixed-term/trainee style tags |
| `work_authorization_scope` | `text` | Stores region/legal eligibility language |
| `compensation_currency`, `compensation_interval` | `text`, `text` | Structured compensation dimensions |
| `compensation_is_estimated`, `bonus_eligible`, `compensation_notes` | `boolean`, `boolean`, `text` | Pay transparency and context |
| `requirements_details` | `jsonb` | Structured minimum/required/preferred requirement buckets |
| `compliance_details` | `jsonb` | EEO/accommodation/at-will/pay transparency flags + text |
| `source_metadata` | `jsonb` | Optional external source metrics (posted date, applicant count, promoted, off-platform responses) |
| `description_raw` | `text` | Preserves original source description text |

## Publish State / Visibility

| Field | Type | Behavior |
|---|---|---|
| `is_active` | `boolean` | `true` = published/visible to students, `false` = draft/inactive |
| `source` | `text` | `employer_self`, `concierge`, `partner` |
| `created_at` | `timestamptz` | Used for “Posted X days ago” |

## Derived / Joined (not authored directly in listing form)

| Source | Field(s) | Usage |
|---|---|---|
| `employer_profiles` | `company_name`, profile media/location | Card/details company context |
| `subscriptions` + employer profile state | verification tier/badge | “Verified Employer” badge rendering |
| canonical link tables | required/preferred skill IDs, coursework IDs | Matching explainability + ranking |

## Read Paths Audited

- Home/jobs card list: `components/jobs/JobsView.tsx` + `app/jobs/_components/JobCard.tsx`
- Listing details page: `app/jobs/[id]/page.tsx`
- Search/filter logic: `components/jobs/JobsView.tsx`
- Apply entry and matching inputs: `app/jobs/[id]/page.tsx`, `app/jobs/_components/applyActions.ts`, `lib/matching.ts`

## Write Paths Audited

- Employer self-serve create/edit: `app/dashboard/employer/page.tsx`
- Concierge/admin create: `app/admin/internships/new/page.tsx`
- Concierge/admin edit: `app/admin/internships/[id]/page.tsx`
