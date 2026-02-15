# Implement: per-listing applicant cap (60) + public applicant count + employer response rate + viewed status
# Unlimited browsing for students. No student-wide apply cap. Add clear, fair messaging.

## Product intent (what we’re building)
- Students can view/browse **all** internships, unlimited.
- Each internship/listing has an **application cap of 60** total submitted applications.
- The **current applicant count is public** on listing cards + listing detail.
- Students get **“Viewed” status** when an employer actually opens their application.
- Employers have a visible **response rate** (percent of applications viewed within X days), shown to students.
- Positioning is “trust + transparency”, not restriction.
  - Students: “This won’t disappear into a black hole.”
  - Employers: “You’ll get a manageable candidate pool; review quickly to build trust.”

This aligns with the reality that low/unknown response rates are a major pain point for job seekers. :contentReference[oaicite:0]{index=0}

---

## 1) Database changes (Supabase migrations)

### A) Add cap + applicant counters
On your internships/listings table (use existing name):
- `application_cap int not null default 60`
- (Optional) `applications_count int not null default 0`  # if you want denormalized fast reads

If you choose denormalized counts:
- Add trigger to increment/decrement `applications_count` on application insert/delete (or status transitions).
- Otherwise compute counts via view/RPC.

### B) Applications table: viewed tracking
On your applications table (existing):
- `submitted_at timestamptz not null default now()`
- `employer_viewed_at timestamptz null`
- `status text not null default 'submitted'`  # keep it simple: submitted | withdrawn | rejected | etc. if already exists, reuse
Indexes:
- `(internship_id, submitted_at)`
- `(user_id, submitted_at)`
- `(internship_id, employer_viewed_at)`

### C) Employer response stats
Implement ONE of:
1) A materialized view refreshed periodically (later)
2) A normal SQL view (fine for now)
3) An RPC function that computes on demand (recommended early)

Define “response rate” as:
- `% of applications to this employer’s internships that have employer_viewed_at set within 7 days of submitted_at`
Also compute:
- `avg_time_to_view_hours` (optional)
- `last_active_at` (optional; update when employer visits dashboard)

Create a view/RPC returning per-employer:
- `viewed_within_7d_rate` (0–100)
- `applications_total`
- `last_active_at` (if available)

Note: transparency and accountability are important in hiring UX. :contentReference[oaicite:1]{index=1}

### D) RLS
- Students can insert/read their own applications.
- Employers can read applications for internships they own.
- Employers can update only `employer_viewed_at` (and possibly status) for their internships.
- Count endpoints/views must not leak private applicant identities—only aggregated numbers.

---

## 2) Server-side enforcement: cap + idempotent apply (race-safe)

Create Postgres RPC `submit_application_with_cap(in_internship_id uuid, in_user_id uuid, ...payload...)`:

Required behavior:
1) Idempotency:
   - If application already exists for (user_id, internship_id) and status != withdrawn, return it.
2) Cap check (race-safe):
   - Lock per internship: `pg_advisory_xact_lock(hashtext(in_internship_id::text))`
   - Count current submitted applications (exclude withdrawn):
     `count(*) where internship_id = in_internship_id and status='submitted'`
   - If count >= application_cap:
     - raise exception `cap_reached`
3) Insert application with `submitted_at=now()` and return row.
4) If using denormalized `applications_count`, update it transactionally.

Update Next.js Apply server action to call this RPC.
UI must not be the only enforcement.

---

## 3) Student UI changes

### A) Listing cards (grid)
Add a small “Applicants” line:
- “Applicants: 14 / 60”
If near cap (>=50):
- Show “Nearly full” badge (subtle).
If cap reached:
- Show “Closed (60 applicants)” and disable Apply button on detail page.

Add a “Trust” line if available:
- “Employer response rate: 72% (views within 7 days)”
If not enough data:
- “New employer — response rate not available yet”

### B) Listing detail page
Show:
- Applicants counter prominently near Apply module:
  - “Applicants: X / 60”
- If cap reached:
  - Replace Apply button with disabled state + message:
    - “Applications closed (60 applicants). Save to track similar roles.”
- If open:
  - Normal apply.

Add a short explainer (student-facing) near the Apply module:

**Headline:** “Transparent applications.”
**Body:** “Internactive shows applicant counts and when employers view your application—so you’re not applying into a black hole.”

Keep it short and not preachy.

### C) My Applications page
For each application:
- If `employer_viewed_at` is set:
  - ✅ “Viewed by employer” + date/time
- Else:
  - “Not viewed yet”

This is the core differentiator.

### D) Save/Bookmark (recommended)
If not already present, add a “Save” button to cards + detail page.
Students should be able to save closed listings and be notified of similar ones later (optional later).

---

## 4) Employer UI changes

### A) Employer Applications list
- Default sort: newest submitted first
- Show at top of each listing:
  - “Applicants: X / 60”
  - “Your response rate (views within 7 days): Y%”
  - Optional coaching: “Viewing applications quickly improves your response rate and boosts student trust.”

### B) Mark “viewed” automatically
When employer opens an application detail:
- Server action updates `employer_viewed_at=now()` if null.
- This should be done server-side, not client-only.

### C) Employer “trust badge”
On employer profile card / listing detail (student side) show:
- “Responds to X% within 7 days”
This incentivizes employers to review.

---

## 5) Messaging (use these exact strings)

### Student-facing
- “Applicants: {count} / {cap}”
- “Transparent applications.”
- “We show applicant counts and when employers view your application—so you’re not applying into a black hole.”
- If cap reached: “Applications closed ({cap} applicants).”

### Employer-facing
- “Students can see applicant counts and when you view applications.”
- “Viewing applications quickly improves trust and your response rate.”

Avoid moralizing. Avoid “limits” language; frame as clarity + fairness.

---

## 6) Edge cases + performance
- If you compute applicant count via query, ensure it’s fast (index on internship_id + status).
- If response rate stats are expensive, cache or compute only on listing detail (not every card) until scale.
- If employer has < N applications total, show “Not enough data yet.”

---

## 7) Tests / acceptance criteria
Must pass:
- Students can browse all internships regardless of cap.
- A listing accepts exactly 60 submitted applications; the 61st is rejected server-side.
- Applicant count displayed matches DB truth.
- Employer viewing an application sets employer_viewed_at and student sees “Viewed”.
- Response rate shown matches definition (views within 7 days).
- No user can see other applicants’ identities via these features (only aggregates).

---

## Deliverables
- SQL migrations (columns, indexes, optional saved_internships)
- RPC function + grants
- Updated apply server action
- UI updates: listing cards, listing detail apply module, my applications, employer applications list
- Tests

