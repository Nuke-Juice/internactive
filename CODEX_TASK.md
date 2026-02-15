You are operating inside this repo. Do NOT write a plan-only document.
MAKE CODE CHANGES in the repository and commit them.

Goal:
- Per-listing application cap: 60 (server-enforced).
- Public applicant count on listing card + listing detail.
- Employer response rate visible to students (views within 7 days).
- “Viewed” status for students when employer opens their application.
- Unlimited browsing; no student-wide cap.

Hard requirements:
1) Create Supabase SQL migration(s) for:
   - add application_cap column to internships/listings table (default 60)
   - add employer_viewed_at + submitted_at to applications table (if missing)
   - add status column if needed (submitted/withdrawn) OR reuse existing
   - indexes needed for counts & response rate
2) Implement a Postgres RPC to submit application with cap enforcement:
   - advisory lock per internship
   - count submitted applications for internship
   - if count >= cap -> throw error code 'cap_reached'
   - idempotent: if same user already applied to same internship, return existing row
3) Update the Next.js apply server action to call the RPC and surface errors.
4) UI updates:
   - Listing cards: show “Applicants: X / 60” (or / application_cap if configurable)
   - Listing detail: show “Applicants: X / 60” near apply module
   - If cap reached: disable apply + show “Applications closed (60 applicants).”
   - My Applications: show “Viewed by employer” with timestamp if employer_viewed_at is set
5) Employer UI:
   - When employer opens application detail, set employer_viewed_at = now() (server-side)
6) Employer response rate:
   - Define: % of applications for employer’s internships where employer_viewed_at is within 7 days of submitted_at.
   - Implement as SQL view or RPC (choose simplest with acceptable performance).
   - Student listing detail should show “Responds to X% within 7 days” OR “Not enough data yet”.

Deliverables must be actual code changes in the repo:
- SQL migration files added under your existing migrations folder
- RPC SQL included in migrations
- Next.js files updated (actions + pages/components)
- Basic tests if this repo already has a test pattern; otherwise add lightweight runtime checks.

After changes:
- run formatting/lint/build and ensure it passes.
- Create a single commit with message: "Applicant cap + transparency (counts, viewed, response rate)"
