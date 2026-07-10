# Error tracking runbook

Server-side exceptions are captured to Sentry via `src/lib/monitoring/sentry.server.ts`. Zero SDK dependency — the module speaks Sentry's envelope protocol directly over `fetch`, so it works uniformly on Cloudflare Workers and Node without touching `package.json`.

## What gets sent

Only real server-side exceptions. `logger.error(...)` alone does **not** send to Sentry — Sentry only receives a call when we explicitly invoke `captureException(err, context)`. Wired sites today:

- `POST /api/admin/oura-sync-cron` — top-level catch on batch failure.
- `POST /api/admin/oura-token-refresh-cron` — top-level catch on batch failure.
- `POST /api/integrations/oura/sync` — top-level catch on the manual "Sync now" path (skipped for the benign `SyncLockHeldError`).
- `syncOuraForUser` — outer catch (skipped for `TokenRevokedError` and `SyncLockHeldError`, which are expected outcomes, not incidents).

Everything else still shows up in the structured log drain (`console.error` from `logger.error`), just not in Sentry.

## Configure

Set on the main-app Worker (via `wrangler secret put` or your environment provider):

- `SENTRY_DSN` — full DSN string, e.g. `https://<publicKey>@o12345.ingest.sentry.io/42`. Required to activate error tracking.
- `SENTRY_ENVIRONMENT` — optional. Defaults to `production`. Use `staging`, `preview`, `local`, etc. per deploy.
- `SENTRY_RELEASE` — optional. Recommended: your git SHA. Enables release-tagged filtering in Sentry.

When `SENTRY_DSN` is absent, every `captureException` call is a no-op and never blocks the request path. This is the intentional default so a missing config does not crash production traffic.

## Verify it's wired

After deploy, trigger any of the wired routes with intentionally bad input (or force a 500 in staging) and confirm the event appears under the DSN's project. The event will include the route, event name, user id (if available), and the exception's stack.

## Adding a new capture site

```ts
import { captureException } from "@/lib/monitoring/sentry.server";

try {
  await riskyThing();
} catch (e) {
  logger.error({ event: "my_flow.failed", error: (e as Error).message });
  void captureException(e, {
    route: "POST /my/route",
    userId,
    event: "my_flow.failed",
    tags: { thing: "value" },
  });
  return errorResponse();
}
```

- Always pair with the structured `logger.error(...)` — Sentry is for pager-worthy incidents, the log drain is for everything.
- `void` the promise. Sentry ingest is best-effort and must never block the request path.
- Skip Sentry for expected outcomes: token-revoked, lock-contention, validation failures, etc. Reserve captures for genuine incidents.

## Sensitive-data posture

- The module extracts only `err.message`, `err.name`, and the stack. It does not walk `err.cause` or serialize arbitrary properties, so accidentally-attached PII on custom Error subclasses will not leak.
- `context.extra` **is** forwarded verbatim. Do not put raw request bodies, tokens, or secrets in there. Prefer id references (`userId`, resource ids) that Sentry can look up out-of-band.

## Rotating the DSN

Rotate `SENTRY_DSN` in your secret manager and redeploy the main app. Both sidecar Workers are independent processes and do not consume the DSN — they only trigger the main app endpoints.
