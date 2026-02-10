# Internactive Product Spec (Current)

## Product Summary
Internactive is a browse-first internship marketplace for students and employers.

- Students can browse internships without logging in.
- Students get best-match ranking after building a profile.
- Employers can post internships and manage applicants.
- Paid plan exists for employers: Verified Employer ($49/month).

## Current Goals
1. Keep first visit simple and friendly.
2. Push profile creation as the step that unlocks better matching.
3. Keep internship discovery focused on paid, high-fit opportunities.
4. Ship practical filters that support local launch targeting.

## Key Routes
- `/` browse-first internship feed (primary landing page)
- `/jobs/[id]` public internship detail page
- `/signup/student` student signup + profile starter
- `/signup/employer` employer onboarding
- `/dashboard/employer` employer posting dashboard
- `/dashboard/employer/applicants` applicant inbox
- `/upgrade` Verified Employer billing page

## Student Experience
- First-time visitors see a friendly message to create a profile for specialized matching.
- Students can browse listings immediately without account friction.
- Student signup now captures:
  - school
  - year
  - gender
  - majors
  - coursework
- Completed profiles improve ranking quality (best-match sort).

## Employer Experience
- Employers can create internships and review applicants in one place.
- Free plan: 1 active internship.
- Verified Employer: $49/month for unlimited internships + email alerts.

## Feed and Filtering
- Default ranking:
  - Logged out: newest listings
  - Logged in student with profile signals: best match
- Filter model (grid layout):
  - category
  - pay range
  - hours per week (max)
  - experience level
  - location + radius distance
  - remote only toggle
- Work-type filter removed (launch focus is internships only).

## Data Notes
Student profile stores core targeting fields used for matching:
- school / university
- major(s)
- coursework
- experience level
- availability
- gender

Internship records include:
- title, company, location
- category and experience level
- work mode (remote/hybrid/on-site)
- term
- hours
- pay string/range
- required/preferred skills
- deadline

## Acceptance Criteria
1. Home page shows a clear first-time CTA to create profile for specialized matches.
2. Filter panel uses grid layout and includes pay range, location/radius, and hours per week.
3. Work type filter is removed from browse UI.
4. Student signup persists gender to `student_profiles`.
5. Feed still supports best-match ranking after profile completion.
