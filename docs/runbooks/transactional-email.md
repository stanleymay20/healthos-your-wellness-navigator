# Transactional email runbook

Server-side transactional email goes out via Resend (`src/lib/email/`). Zero SDK dependency — the module talks to Resend's HTTP API directly. Templates are pure functions in `src/lib/email/templates/` and can be tested in isolation.

## What we send today

- **Deletion scheduled** — `POST /api/me/delete` fires this once the account-deletion row is upserted. Tells the user the deletion is queued, when it will execute, and how to cancel.
- **Deletion cancelled** — `DELETE /api/me/delete` fires this only when we actually flipped a pending row. A no-op cancel does not send a misleading "we cancelled it" mail.

Both are fire-and-forget: the response is returned immediately and email delivery is best-effort. A missing `RESEND_API_KEY` degrades to a warning log — the underlying deletion still succeeds.

## What we do NOT send (yet)

- **Signup verification** and **password reset** — Supabase Auth owns these. Configure via Supabase → Auth → Email Templates. If you want them going through Resend, set Resend as the SMTP provider in Supabase Auth settings; no code change here.
- **Pre-deletion warning** — a "your account deletes in 24h" nudge would be a nice follow-up before the cron sweeper runs. Not shipped today.
- **Weekly report** and **sync-failure notifications** — product decisions, not shipped.

## Configure

Set on the main-app Worker (via `wrangler secret put` or your environment provider):

- `RESEND_API_KEY` — required. Get from `https://resend.com/api-keys`.
- `RESEND_FROM_EMAIL` — optional. Defaults to `HealthOS <noreply@healthos.app>`. Set to a verified sender on your Resend domain, e.g. `HealthOS <noreply@yourdomain.com>`.

Verify your domain in Resend (SPF + DKIM) before setting `RESEND_FROM_EMAIL`, or delivery will fail with 403.

## Adding a new template

1. Add a pure function in `src/lib/email/templates/<name>.ts` that returns `{ subject, html, text }`. Keep both HTML and plain-text bodies — some inboxes still show text-only.
2. Add a helper in `src/lib/email/index.server.ts` that wraps the template with a `sendEmail` call and a distinct `event` string for the log drain.
3. Add a test file mirroring `deletion-scheduled.test.ts` — assert on subject / text presence, not exact copy.
4. Wire the send at the appropriate route (always `void` the promise so it doesn't block the response).

## Sensitive-data posture

- Recipient email is logged under the `user_email` key so the logger masks it to `xx***@domain`.
- Only the subject and the Resend `trigger` event name are stored in the log drain — no email body content.
- Templates are pure and take structured inputs; they cannot accidentally interpolate a database row or a request body.

## Rotating the API key

Rotate `RESEND_API_KEY` in your secret manager, redeploy the main app. In-flight sends complete against the previous key; new sends pick up the new key immediately.
