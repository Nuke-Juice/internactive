You are inside the Internactive repo. DO NOT write a plan-only doc.
MAKE CODE CHANGES and commit them.

Bug:
On /signup/student/details (Step 2 of onboarding), clicking the back arrow shows the login page with auth fields even though the user is already logged in.
Expected:
Back arrow should take the user to the previous onboarding step (Step 1 profile creation page), not the auth form.

Implement:

1) Step-aware back navigation on onboarding pages
- On the student details page (/signup/student/details), update the back arrow handler to navigate explicitly to the Step 1 onboarding route (the initial student profile creation page).
- Do not use a hardcoded /login route.
- Prefer router.push("/signup/student") (or the actual Step 1 path in this repo).
- Avoid router.back() here because browser history may include auth pages; we want deterministic navigation.

2) Auth form should not render for authenticated users
- Identify the route/page that rendered the login form when you hit back (likely /signup/student or /login).
- Add a guard: if a session exists, do NOT show auth fields.
- Instead redirect the user to the correct place:
  - If student onboarding is incomplete -> redirect to the first incomplete onboarding step (Step 1 or Step 2 depending on saved profile completeness).
  - Else redirect to the student home/jobs page (whatever is standard in this repo).
- Use existing session retrieval + postAuthRedirect/profileCompleteness logic already in the codebase.

3) Preserve query param "next" behavior
- If the auth page is visited with ?next=..., and the user is already authenticated, redirect to next.
- If no next, use the onboarding completeness redirect as above.

4) Ensure no redirect loops
- Make sure the redirect logic doesn’t bounce between routes (add guards to prevent loop).

5) Tests / sanity checks
- Manual flow to validate:
  - Login as student -> go to /signup/student/details -> click back -> lands on Step 1 onboarding page (not login form)
  - Directly visit /signup/student while logged in -> does not show auth form; redirects to correct onboarding step or jobs
  - Logged out users still see auth form normally

After changes:
- npm run build must pass.
- Commit message: "Fix onboarding back navigation for logged-in students"
