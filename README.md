# HealthOS

Consumer wellness app that turns the health data you already have into daily, personalized guidance. Connect an Oura Ring (or log manually — sleep, water, exercise, stress, meditation) and each day get six 0–100 sub-scores, adaptive-baseline insights compared to your own recent days, and a weekly report with plan-adherence tracking.

React 19 + TanStack Start on Cloudflare Workers, Supabase for auth + Postgres, Tailwind v4.

## Quick start

```bash
npm install
cp .env.example .env          # fill in your Supabase values
npm run dev                   # http://localhost:5173
```

For every subsystem beyond auth + core scoring, the app is designed to run degraded when its env var is missing — a missing `SENTRY_DSN` / `RESEND_API_KEY` / `STRIPE_SECRET_KEY` skips the feature with a warning log rather than crashing. Fill them in as you turn each subsystem on.

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start Vite dev server                     |
| `npm run build`     | Production build (also regenerates the TanStack route tree) |
| `npm run build:dev` | Development-mode build                    |
| `npm run preview`   | Serve the production build locally        |
| `npm run lint`      | ESLint                                    |
| `npm run format`    | Prettier (writes)                         |
| `npm test`          | Vitest — pure-module and Worker unit tests |
| `npm run e2e`       | Playwright — public-surface e2e specs      |
| `npm run e2e:ui`    | Playwright interactive runner              |
| `npx tsc --noEmit`  | Typecheck only                            |

## What's shipped

### Adaptive scoring pipeline (real-data only)

The scoring / insight / risk path is pure math over the user's own snapshots. Every threshold is either derived from the user's history or a documented calibration constant — see `docs/reports/real-data-purity-audit.md` for the classified sweep.

- `src/lib/scoring/derive.ts` — pure aggregation rule: `overall = mean of present sub-scores`. Stress is derived from Oura `daily_readiness` `hrv_balance` + `resting_heart_rate` contributors.
- `src/lib/scoring/baseline.ts` — rolling 5–14 day baseline per dimension (mean, stddev, p25). Fires "elevated" at 1σ, "high" at 2σ or overall ≤ −1.5σ.
- `src/lib/insights/generate.ts` — baseline-aware insights first (deviation-based); percentile-cut fallback (`p25` of the user's own history) for softer signals, with the legacy fixed cuts as the true cold-start floor.
- `src/lib/scoring/parity.ts` — compares live-written and snapshot-derived scores for operational cutover safety.

### Oura ingestion

- `src/lib/providers/oura-sync.server.ts` — per-user sync orchestrator with a TTL'd advisory lock (10 min) on `device_connections.locked_until`. Atomic conditional UPDATE per (user, provider) prevents concurrent sync races; second caller gets `SyncLockHeldError` and 409s cleanly.
- `src/lib/providers/oura-sync-batch.server.ts` — batch runner. Counts `users_synced` / `users_skipped` / `users_failed` and writes a `sync_runs` row per run.
- `src/lib/providers/oura-token-refresh.server.ts` — proactively refreshes tokens expiring in the next 6h so a sleep-time sync doesn't burn its first request on a stale token. Shares the sync lock so refresh and sync never race on the rotated `refresh_token`.
- Two sidecar Cloudflare Workers drive the crons: `src/worker-scheduled.ts` (sync, every 30 min) and `src/worker-token-refresh.ts` (refresh, every 4h). Deployed independently from the main app via `wrangler-scheduled.jsonc` and `wrangler-token-refresh.jsonc` so operator levers rotate independently.

### Billing

Stripe integration is zero-dep — `src/lib/billing/stripe.server.ts` speaks the REST API via `fetch` and implements the exact HMAC-SHA256 webhook verification scheme (constant-time compare, 5-minute clock tolerance, rotated-secret support).

- `POST /api/billing/checkout` — creates a hosted Checkout Session for the selected plan.
- `POST /api/billing/portal` — opens the Stripe Billing Portal for existing customers.
- `POST /api/billing/webhook` — verifies signature, upserts `subscriptions` on `checkout.session.completed` and `customer.subscription.*` events.
- Plan slug ↔ Stripe price id map is env-driven (`STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_FAMILY_MONTHLY`) so prices rotate without a code deploy.
- Client-side helpers in `src/lib/billing/client-actions.ts`; the Settings billing section and Pricing CTAs are wired.

### Error tracking

- `src/lib/monitoring/sentry.server.ts` — zero-dep Sentry client speaking the envelope protocol via `fetch`. Gated on `SENTRY_DSN` — every call is a no-op when the env var is absent.
- Wired at the four top-level incident catches (both admin cron routes, manual sync, `syncOuraForUser`'s outer catch). Expected outcomes (`TokenRevokedError`, `SyncLockHeldError`) are skipped so benign conditions don't page.

### Transactional email

- `src/lib/email/resend.server.ts` — zero-dep Resend client. Gated on `RESEND_API_KEY`; missing config logs a warning and returns `{ ok: false, reason: "not_configured" }` so the caller's business action still succeeds.
- Templates in `src/lib/email/templates/` are pure functions returning `{ subject, html, text }`. Currently: deletion-scheduled, deletion-cancelled. Signup verification and password reset stay owned by Supabase Auth.

### Privacy + compliance

- Versioned consent capture (`consent_acceptances`); Settings re-consent on version bump.
- GDPR Article 17: `POST /api/me/delete` schedules a 30-day soft-delete with a cancel window; `DELETE /api/me/delete` reverses it. Both send confirmation email.
- GDPR Article 20: `GET /api/me/export` downloads a JSON dump of the user's data.
- `admin_audit_log` records every admin-secret-gated call with route, IP, outcome, and status.
- Structured logger with PII masking: `email` keys become `xx***@domain`; token / secret keys become `[redacted]`.

## Project layout

```
src/
  routes/          TanStack file-based routes (_app/* = protected)
    api/           Server handlers (admin, billing, integrations, me)
  components/      UI — brand, dashboard, landing, settings, ui
  contexts/        AuthContext (Supabase session)
  integrations/    Supabase client (browser + server-only admin)
  services/        Domain reads — health, scoring, billing
  lib/
    scoring/       Pure adaptive-baseline pipeline
    insights/      Insight text generation
    providers/     Oura sync + token refresh
    billing/       Stripe client + plan mapping + client actions
    email/         Resend client + templates
    monitoring/    Sentry envelope client
    log/           Structured PII-masking logger
    audit/         Admin audit log writer
    consent/       Consent versions + acceptance
    rate-limit/    Per-IP token-bucket
    api/           Response + client IP helpers
  worker-scheduled.ts        Sync cron sidecar (Cloudflare Worker)
  worker-token-refresh.ts    Token-refresh cron sidecar (Cloudflare Worker)
supabase/
  migrations/      SQL schema + RLS policies
e2e/               Playwright specs (public marketing surface)
docs/
  reports/         Real-data purity audit
  runbooks/        Per-subsystem operator docs
```

## Runbooks

Operator docs live under `docs/runbooks/`. Read the relevant one before turning a subsystem on in production.

- `docs/runbooks/error-tracking.md` — Sentry configuration, adding capture sites, sensitive-data posture.
- `docs/runbooks/transactional-email.md` — Resend configuration, template authoring, sender domain setup.
- `docs/runbooks/billing.md` — Stripe secrets, webhook endpoint, price rotation, security notes on the verifier.
- `docs/runbooks/dtc-launch-checklist.md` — the end-to-end pre-launch pass. Walk through this on a staging deploy before flipping the live switch.

## Testing

- **Vitest** — 100+ pure-module unit tests. Covers the scoring pipeline (`baseline`, `derive`, `parity`, `insights/generate`), the Sentry / Resend / Stripe / Plans clients, the webhook signature verifier (every rejection path), the plan-derivation truth table, and both cron-sidecar Workers.
- **Playwright** — public-surface e2e specs in `e2e/`. Uses the container's pre-installed Chromium (`/opt/pw-browsers/chromium`); no download needed. Auth / dashboard / billing flows are documented in the launch checklist for a staging deploy (they need real Supabase creds).

## Environment variables

See `.env.example` for the baseline (Supabase URL + anon key). Additional env vars unlocked by the subsystems above:

| Var                                          | Purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`                  | Server-only admin client (token / audit writes) |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | Error tracking                       |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`        | Transactional email                         |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing + webhook auth                      |
| `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_FAMILY_MONTHLY` | Plan ↔ price mapping     |
| `SYNC_CRON_SECRET`                           | Shared secret between main app and sync sidecar |
| `TOKEN_REFRESH_CRON_SECRET`                  | Same, for the token-refresh sidecar         |
| `BACKFILL_ADMIN_SECRET`, `PARITY_ADMIN_SECRET` | Per-route admin secrets                   |

RLS protects user data; the anon key is safe in the browser. **Never commit a real `.env`.**

## Database

Schema in `supabase/migrations/`. Key tables:

- **Domain**: `profiles`, `user_preferences`, `health_logs`, `health_scores`, `insights`, `recommendations`.
- **Wearables**: `device_connections` (with `locked_until` sync lock), `device_oauth_tokens` (service-role only), `wearable_daily_snapshots` (raw Oura payloads).
- **Ops**: `sync_runs` (per-batch outcome), `admin_audit_log` (every admin call).
- **Compliance**: `consent_acceptances` (versioned), `account_deletions` (30-day soft delete queue).
- **Billing**: `subscriptions` (mirror of Stripe state).

All user-facing tables have RLS scoped to `auth.uid()`. Token and admin tables have no user-facing policies — service role only.

## Auth & onboarding

Signed-in users land on `/dashboard`. New users are redirected to `/onboarding` until `profiles.full_name` and `user_preferences.health_goal` are both set. The completeness check is centralized in `src/lib/onboarding.ts`. Consent-version bumps re-arm the acceptance screen in Settings.

## Deploying

Main app: standard Cloudflare Workers deploy (`wrangler deploy`). Sidecar Workers are separate deploys:

```bash
wrangler deploy --config wrangler-scheduled.jsonc           # sync cron
wrangler deploy --config wrangler-token-refresh.jsonc       # token refresh cron
```

Set the corresponding `*_TARGET_URL` vars and secrets on each sidecar. The launch checklist walks the full env-var + webhook + sidecar sequence.
