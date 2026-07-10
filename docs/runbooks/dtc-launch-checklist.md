# DTC launch checklist

The pre-launch verification pass — things that are neither obvious from the code nor covered by unit tests. Run through this on a **staging deploy against a staging Supabase project** before flipping the "live" switch. Every item is either automated (Playwright, unit tests) or a manual click-through.

Nothing here replaces the Phase 32 real-data purity audit or the runbook docs for individual subsystems (`docs/runbooks/`). This checklist is the "did we actually ship it end-to-end" pass.

## 0. Environment sanity

- [ ] All required env vars set on the main app worker: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_FAMILY_MONTHLY`, `SYNC_CRON_SECRET`, `TOKEN_REFRESH_CRON_SECRET`.
- [ ] Sidecar workers deployed independently: `wrangler deploy --config wrangler-scheduled.jsonc`, `wrangler deploy --config wrangler-token-refresh.jsonc`. Their `*_TARGET_URL` vars point at the main app's staging host.
- [ ] Sidecar secrets set: `wrangler secret put SYNC_CRON_SECRET --config wrangler-scheduled.jsonc` (same value as main app), same for token refresh.
- [ ] Resend sender domain verified (SPF + DKIM). `RESEND_FROM_EMAIL` uses that domain.
- [ ] Stripe webhook endpoint configured in the Stripe dashboard: URL = `https://<staging-host>/api/billing/webhook`, events subscribed = `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Signing secret matches `STRIPE_WEBHOOK_SECRET`.
- [ ] Supabase Auth email templates configured (verification, password reset). If routing them through Resend, SMTP settings in Supabase Auth point at Resend.

## 1. Automated checks

- [ ] `npm test` — all vitest suites green.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — clean; bundle size in the expected range (no unexpected new mega-chunk).
- [ ] `npx playwright test` against the staging host: `PLAYWRIGHT_BASE_URL=https://<staging> npx playwright test`. Landing / pricing / auth-bounce specs green.

## 2. Auth + onboarding golden path

Do this against a fresh browser profile (no cookies).

- [ ] Landing page renders below the fold. Nav links to About / Blog / Pricing all 200.
- [ ] Sign up with a real inbox address you can check.
- [ ] Verification email arrives from the configured `RESEND_FROM_EMAIL`. Sender address renders correctly. Link opens the app signed in.
- [ ] Onboarding flow renders. Complete every step. Final "Save" lands on `/dashboard`.
- [ ] Dashboard renders even with empty data — no runtime errors, no infinite spinners. Cards degrade gracefully to "not enough data yet" copy.

## 3. Manual health-log path

- [ ] Log a day: sleep, activity, water, stress. Save.
- [ ] Score recomputes and dashboard reflects the new day.
- [ ] Log a second day. Weekly delta + insights render.
- [ ] After 5+ days of logs, baseline-aware insights start firing (deviation-based).

## 4. Oura integration path

Only if you have Oura credentials in the staging environment.

- [ ] From Devices → Connect Oura. Redirected to Oura's OAuth screen. Complete authorization.
- [ ] Redirected back to `/devices`. Connection status shows "Connected".
- [ ] Trigger "Sync now". Snapshots arrive; dashboard shows sleep / recovery / activity / stress scores populated for the last 14 days.
- [ ] Manually query the `subscriptions` table: the row is absent (free tier).
- [ ] Wait for the scheduled sync sidecar to fire once (or trigger the cron endpoint manually with the shared secret). `sync_runs` gets a new row with `users_synced` incremented.

## 5. Billing path (Stripe test mode)

Use Stripe's test cards: `4242 4242 4242 4242` for success, `4000 0000 0000 0002` for declined.

- [ ] `/pricing` — Pro / Family CTAs are buttons (not bare links). Free CTA still a link.
- [ ] Click Pro → redirected to Stripe Checkout. Cancel — returns to `/pricing?checkout=cancelled` and a toast fires.
- [ ] Click Pro again → complete checkout with the success card. Returned to `/settings?checkout=success` with a success toast.
- [ ] Wait ~5 seconds (webhook needs to hit `subscriptions`), reload settings. Billing section now says "Current plan: pro" with a renewal date.
- [ ] Click Manage subscription → Stripe billing portal opens in the same tab. Cancel from portal, return to `/settings`. Row updates to `cancel_at_period_end = true`; UI banner surfaces the end-of-period date.
- [ ] Reactivate from the portal. Row flips back; banner clears.
- [ ] Test with the declined card: checkout fails at Stripe, no local subscription row is created. Sanity: only successful checkouts should ever create a row.
- [ ] Verify webhook events in `admin_audit_log` and the Sentry issue tracker — no `billing.webhook_failed` events on happy-path flows.

## 6. Deletion path

- [ ] From Settings → Account, request deletion. Response is 200; the "Scheduled for deletion" banner appears with the correct 30-day-forward date.
- [ ] Deletion-scheduled email arrives at the account's address. Text and HTML both render; unsubscribe / support links (if added) work.
- [ ] Cancel deletion. Banner clears. Deletion-cancelled email arrives.
- [ ] Re-request deletion. Second scheduled email arrives (fresh 30-day window from second request).

## 7. Data-export path

- [ ] Settings → "Export my data". A JSON file downloads within a few seconds. Filename matches `healthos-export-YYYY-MM-DD.json`.
- [ ] File contents include health_scores, insights, recommendations, health_logs, device_connections, wearable_daily_snapshots for the current user. No other users' rows.

## 8. Failure-path sanity

- [ ] Kill `STRIPE_WEBHOOK_SECRET` temporarily and re-fire a webhook via Stripe's dashboard: main app 503s cleanly; Sentry captures nothing (403 before any code that captures).
- [ ] Kill `RESEND_API_KEY` and request a deletion: response is 200 (business action succeeded), log line shows `email.skipped_not_configured`, no email arrives, no Sentry.
- [ ] Kill `SENTRY_DSN` and force any 500-worthy error: response returns the 500, log line is written, no Sentry event. Verifies fail-open behavior.
- [ ] Concurrent-sync race: trigger the manual "Sync now" and, within seconds, hit the cron endpoint. Second sync returns 409 (from manual) or is counted as skipped (from cron). No double-write to `health_scores`.
- [ ] Token refresh sidecar runs: `sync_runs`-style visibility for the refresh path is via logs / Sentry only today. Verify the log line `oura_token_refresh_cron.completed` fires with a sane `candidates` count.

## 9. Mobile responsive

Two devices; open Chrome DevTools' device mode if needed.

- [ ] Landing page renders on mobile (no horizontal scroll, hero legible).
- [ ] Pricing tiers stack, CTAs stay tappable.
- [ ] Auth form works; can complete signup on mobile.
- [ ] Dashboard: sub-score cards stack; charts do not overflow.
- [ ] Settings: BillingSection buttons wrap gracefully; portal link is tappable.

## 10. Accessibility spot-check

- [ ] Keyboard-only navigation: can complete signup and log a day without touching the mouse.
- [ ] Screen-reader spot check on dashboard (VoiceOver / NVDA): the primary score number is announced with a label ("Overall score, 72 out of 100"), not just a bare number.
- [ ] Contrast: primary text on the dark hero panel passes AA at body text sizes.

## 11. Legal / marketing surfaces

- [ ] `/legal/terms` and `/legal/privacy` exist and match the `ACTIVE_VERSIONS` referenced by consent capture.
- [ ] The consent versions bump requires the user to re-accept after login. Simulate: bump `ACTIVE_VERSIONS`, sign in as an existing user, confirm the re-consent screen fires.
- [ ] Footer links, contact address, and any social handles resolve.

## 12. Rollback plan

- [ ] Know which git commit is currently deployed to production (`git log --oneline` at deploy time; note it in your deploy log).
- [ ] Have a documented rollback command for both the main app and each sidecar worker.
- [ ] Sentry alerting is on for `severity: error` events at more than N per minute (set N based on your traffic).
