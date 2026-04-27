# Cron driver — scheduled Oura sync

The main app exposes `POST /api/admin/oura-sync-cron`, which iterates
every connected Oura user and runs a sync (Phase 2 batch logic). The
endpoint requires the `x-sync-secret` header to match `SYNC_CRON_SECRET`
in the main app's environment.

This runbook covers the **default driver**: a sidecar Cloudflare Worker
in this repo (`src/worker-scheduled.ts` + `wrangler-scheduled.jsonc`)
that fires on a Cron Trigger and POSTs the endpoint.

The sidecar is intentionally separate from the main app's Worker because
the framework owns the main app's server entry and we don't want to
fork it.

## Prerequisites

- The main app is deployed and reachable at a stable URL.
- `SYNC_CRON_SECRET` is set on the main app.

## Deploy

1. Decide the schedule. Default is `*/30 * * * *` (every 30 min) in
   `wrangler-scheduled.jsonc`. Tune the `triggers.crons` array as needed.
   Cloudflare cron triggers run at most once per minute.
2. Set the target URL:
   ```sh
   wrangler deploy --config wrangler-scheduled.jsonc \
     --var SYNC_CRON_TARGET_URL:"https://app.example.com/api/admin/oura-sync-cron"
   ```
3. Set the shared secret (one-time):
   ```sh
   wrangler secret put SYNC_CRON_SECRET --config wrangler-scheduled.jsonc
   ```
   Use the **same** value as the main app's `SYNC_CRON_SECRET`.

## Verify

- Trigger immediately (without waiting for the schedule):
  ```sh
  wrangler deploy --config wrangler-scheduled.jsonc
  curl -X POST "https://healthos-cron-sidecar.<account>.workers.dev/__scheduled?cron=*/30+*+*+*+*"
  ```
  (Cloudflare exposes the `__scheduled` test path for cron triggers.)
- Tail logs:
  ```sh
  wrangler tail --config wrangler-scheduled.jsonc
  ```
  Successful runs emit `event: "cron_sidecar.completed"`. Non-2xx
  responses from the main app emit `event: "cron_sidecar.target_non_2xx"`.
- Confirm in the main app: a new row should appear in `public.sync_runs`
  with the latest `started_at`.

## Operational notes

- **Failure isolation**: the sidecar never throws — failures are logged.
  The main app's batch logic also isolates per-user failures so one bad
  user can't halt the run.
- **Concurrency**: Cloudflare cron triggers don't overlap by default; if
  a previous run is still in flight when the next fires, the new one is
  skipped at the platform level.
- **Rate-limit interaction**: the main app rate-limits
  `/api/admin/oura-sync-cron` at 60/hour per IP. A 30-minute cadence
  stays well under that.
- **Pausing**: redeploy with `triggers.crons: []` or disable the Worker
  in the Cloudflare dashboard. The endpoint itself remains unaffected.

## Alternatives

If you don't want a CF sidecar Worker, any HTTP-capable scheduler works
because the endpoint is plain HTTP:

- GitHub Actions scheduled workflow (`schedule:` trigger + `curl`)
- Vercel Cron, EasyCron, cron-job.org, Better Stack Heartbeats
- A traditional crontab on a server with `curl`

The main app does not care which driver fires it as long as the
`x-sync-secret` header matches.
