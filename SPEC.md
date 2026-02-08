# InternUP - Browse-first feed + Micro-onboarding + Curated feed

## Goal
Make the site feel fast like Indeed:
- Users can browse jobs immediately (no login wall)
- Login/profile is required only when clicking Apply (or Save)
- After signup, feed becomes curated using stored profile fields

## Current behavior
- Home page has CTA buttons that lead to signup
- Feed is not the primary landing experience
- Users may be forced to sign up too early

## Desired behavior
1) / shows a light job feed preview + category tiles
2) /jobs shows the browse-first job feed (no login required)
3) Job detail pages are viewable without login
4) Clicking Apply triggers micro-onboarding:
   - Collect school, major, availability
   - Create or require login
   - Save fields to user profile
   - Submit application
5) After login, /jobs sorts by Best match

## Routes
- /
- /jobs
- /jobs/[id]

## UI requirements
- Minimal and fast, not overwhelming
- Category tiles (8–12)
- Few visible filters
- Advanced filters hidden behind Refine
- Apply button on job card and detail

## Data model
User profile:
- school
- major
- availability

Job fields:
- category
- preferred majors
- preferred availability

## Matching rules
- Logged out: sort by newest
- Logged in: sort by simple match score + newest

## Acceptance tests
- /jobs loads without login
- Job detail loads without login
- Apply opens micro-onboarding
- Profile fields saved on apply
- Feed is curated after login

## Out of scope
- Payments
- AI features
- Messaging
- Notifications
