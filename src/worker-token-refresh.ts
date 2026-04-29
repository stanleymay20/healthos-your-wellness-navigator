// Cloudflare Workers sidecar that drives proactive Oura token refresh.
//
// This is a separate Worker deploy (see wrangler-token-refresh.jsonc),
// independent from the sync sidecar in worker-scheduled.ts. It runs on
// Cloudflare's cron schedule and POSTs the main app's
// /api/admin/oura-token-refresh-cron endpoint with the shared secret.
//
// Required environment bindings:
//   TOKEN_REFRESH_CRON_TARGET_URL  e.g. "https://app.example.com/api/admin/oura-token-refresh-cron"
//   TOKEN_REFRESH_CRON_SECRET      same value as the main app's TOKEN_REFRESH_CRON_SECRET
//
// Optional:
//   TOKEN_REFRESH_CRON_TIMEOUT_MS  request timeout in ms (default 60000)

export type TokenRefreshEnv = {
  TOKEN_REFRESH_CRON_TARGET_URL: string;
  TOKEN_REFRESH_CRON_SECRET: string;
  TOKEN_REFRESH_CRON_TIMEOUT_MS?: string;
};

type CronEvent = {
  cron: string;
  scheduledTime: number;
};

type ExecCtx = {
  waitUntil(promise: Promise<unknown>): void;
};

export type TokenRefreshTriggerOutcome = {
  url: string;
  status: number;
  ok: boolean;
  bodyHead: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export async function triggerTokenRefresh(
  env: TokenRefreshEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenRefreshTriggerOutcome> {
  if (!env.TOKEN_REFRESH_CRON_TARGET_URL) {
    throw new Error("TOKEN_REFRESH_CRON_TARGET_URL not configured");
  }
  if (!env.TOKEN_REFRESH_CRON_SECRET) {
    throw new Error("TOKEN_REFRESH_CRON_SECRET not configured");
  }
  const timeoutMs = Number(env.TOKEN_REFRESH_CRON_TIMEOUT_MS) > 0
    ? Number(env.TOKEN_REFRESH_CRON_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(env.TOKEN_REFRESH_CRON_TARGET_URL, {
      method: "POST",
      headers: {
        "x-token-refresh-secret": env.TOKEN_REFRESH_CRON_SECRET,
        "user-agent": "healthos-token-refresh-sidecar/1.0",
      },
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    return {
      url: env.TOKEN_REFRESH_CRON_TARGET_URL,
      status: res.status,
      ok: res.ok,
      bodyHead: text.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async scheduled(event: CronEvent, env: TokenRefreshEnv, ctx: ExecCtx) {
    ctx.waitUntil(
      (async () => {
        try {
          const outcome = await triggerTokenRefresh(env);
          console.log(JSON.stringify({
            ts: new Date(event.scheduledTime).toISOString(),
            level: "info",
            event: "token_refresh_sidecar.completed",
            cron: event.cron,
            target: outcome.url,
            status: outcome.status,
            ok: outcome.ok,
          }));
          if (!outcome.ok) {
            console.error(JSON.stringify({
              ts: new Date().toISOString(),
              level: "error",
              event: "token_refresh_sidecar.target_non_2xx",
              cron: event.cron,
              status: outcome.status,
              bodyHead: outcome.bodyHead,
            }));
          }
        } catch (err) {
          console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            event: "token_refresh_sidecar.failed",
            cron: event.cron,
            error: (err as Error).message,
          }));
        }
      })(),
    );
  },
};
