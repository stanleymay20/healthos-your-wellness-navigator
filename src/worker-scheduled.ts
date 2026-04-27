// Cloudflare Workers sidecar that drives the scheduled Oura sync.
//
// This is a separate Worker deploy (see wrangler-scheduled.jsonc). It runs
// on Cloudflare's cron schedule and POSTs the main app's
// /api/admin/oura-sync-cron endpoint with the shared secret. We use a
// sidecar instead of hooking `scheduled` into the main app's Worker
// because the main app's server-entry is owned by the TanStack Start
// framework — wrapping it would risk breaking the build pipeline.
//
// Required environment bindings:
//   SYNC_CRON_TARGET_URL  e.g. "https://app.example.com/api/admin/oura-sync-cron"
//   SYNC_CRON_SECRET      same value as the main app's SYNC_CRON_SECRET
//
// Optional:
//   SYNC_CRON_TIMEOUT_MS  request timeout in ms (default 60000)

export type ScheduledEnv = {
  SYNC_CRON_TARGET_URL: string;
  SYNC_CRON_SECRET: string;
  SYNC_CRON_TIMEOUT_MS?: string;
};

type CronEvent = {
  cron: string;
  scheduledTime: number;
};

type ExecCtx = {
  waitUntil(promise: Promise<unknown>): void;
};

export type CronTriggerOutcome = {
  url: string;
  status: number;
  ok: boolean;
  bodyHead: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export async function triggerCron(env: ScheduledEnv, fetchImpl: typeof fetch = fetch): Promise<CronTriggerOutcome> {
  if (!env.SYNC_CRON_TARGET_URL) {
    throw new Error("SYNC_CRON_TARGET_URL not configured");
  }
  if (!env.SYNC_CRON_SECRET) {
    throw new Error("SYNC_CRON_SECRET not configured");
  }
  const timeoutMs = Number(env.SYNC_CRON_TIMEOUT_MS) > 0
    ? Number(env.SYNC_CRON_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(env.SYNC_CRON_TARGET_URL, {
      method: "POST",
      headers: {
        "x-sync-secret": env.SYNC_CRON_SECRET,
        "user-agent": "healthos-cron-sidecar/1.0",
      },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return {
      url: env.SYNC_CRON_TARGET_URL,
      status: res.status,
      ok: res.ok,
      bodyHead: text.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async scheduled(event: CronEvent, env: ScheduledEnv, ctx: ExecCtx) {
    ctx.waitUntil(
      (async () => {
        try {
          const outcome = await triggerCron(env);
          // Workers route console.* to log drains; matches the structured
          // logger in the main app so downstream filtering works.
          console.log(JSON.stringify({
            ts: new Date(event.scheduledTime).toISOString(),
            level: "info",
            event: "cron_sidecar.completed",
            cron: event.cron,
            target: outcome.url,
            status: outcome.status,
            ok: outcome.ok,
          }));
          if (!outcome.ok) {
            console.error(JSON.stringify({
              ts: new Date().toISOString(),
              level: "error",
              event: "cron_sidecar.target_non_2xx",
              cron: event.cron,
              status: outcome.status,
              bodyHead: outcome.bodyHead,
            }));
          }
        } catch (err) {
          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            event: "cron_sidecar.failed",
            cron: event.cron,
            error: (err as Error).message,
          }));
        }
      })(),
    );
  },
};
