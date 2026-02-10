# Email Verification Setup (Supabase)

Use these settings to enforce verified-email gating for student applications and employer publishing.

## Supabase Auth Settings

1. Enable **Confirm email**:
- Supabase Dashboard -> Authentication -> Providers -> Email
- Turn on email confirmation so new users must verify before high-value actions.

2. Configure **Site URL**:
- Set to production app origin, e.g. `https://your-domain.com`
- Local dev fallback can remain `http://localhost:3000`.

3. Configure **Redirect URLs**:
- Add local callback URL:
  - `http://localhost:3000/auth/callback`
- Add production callback URL:
  - `https://your-domain.com/auth/callback`
- If you use preview domains, add each preview callback URL as well.

## App Behavior

- Unverified students cannot submit applications.
- Unverified employers cannot publish internships.
- Drafting/browsing remains available.
- Unverified users are sent to `/verify-required?next=...`.
- Verification emails are resent through:
  - `/verify-required`
  - header banner resend action

## Related Routes

- Callback exchange: `/auth/callback`
- Verify-required UI: `/verify-required`
- Resend API endpoint (header banner): `/api/auth/resend-verification`
