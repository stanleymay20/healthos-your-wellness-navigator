// Scheduled / background Oura token-refresh trigger. Not user-facing.
//
// Gated by TOKEN_REFRESH_CRON_SECRET (separate from SYNC_CRON_SECRET so
// the two operator levers rotate independently). Fail-closed 503 when the
// secret is not configured.
//
// Mirrors the shape of /api/admin/oura-sync-cron deliberately so the
// sidecar Worker pattern is uniform across both background trackers.

import { createFileRoute } from "@tanstack/react-router";
import { runScheduledTokenRefresh } from "@/lib/providers/oura-token-refresh.server";
import { logger } from "@/lib/log/logger";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { recordAdminAudit, type AdminAuditFields } from "@/lib/audit/admin.server";

const ROUTE = "POST /api/admin/oura-token-refresh-cron";
const RATE_LIMIT = 60;
const RATE_WINDOW_SEC = 3600;

export const Route = createFileRoute("/api/admin/oura-token-refresh-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const auditBase: Pick<AdminAuditFields, "route" | "callerIp"> = {
          route: ROUTE,
          callerIp,
        };

        const limit = enforceRateLimit(`token_refresh:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          const res = secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
          await recordAdminAudit({ ...auditBase, outcome: "rate_limited", statusCode: 429 });
          return res;
        }

        const cronSecret = process.env.TOKEN_REFRESH_CRON_SECRET;
        if (!cronSecret) {
          const res = secureJsonResponse(
            { error: "Token refresh disabled: TOKEN_REFRESH_CRON_SECRET not configured" },
            503,
          );
          await recordAdminAudit({ ...auditBase, outcome: "config_missing", statusCode: 503 });
          return res;
        }
        const provided = request.headers.get("x-token-refresh-secret");
        if (!provided || provided !== cronSecret) {
          const res = secureJsonResponse({ error: "Forbidden" }, 403);
          await recordAdminAudit({ ...auditBase, outcome: "forbidden", statusCode: 403 });
          return res;
        }

        try {
          const outcome = await runScheduledTokenRefresh();
          logger.info({
            event: "oura_token_refresh_cron.completed",
            candidates: outcome.candidates,
            refreshed: outcome.refreshed,
            invalidated: outcome.invalidated,
            skipped: outcome.skipped,
            failed: outcome.failed,
          });
          const res = secureJsonResponse({ ok: true, ...outcome });
          await recordAdminAudit({
            ...auditBase,
            outcome: "ok",
            statusCode: 200,
            details: {
              candidates: outcome.candidates,
              refreshed: outcome.refreshed,
              invalidated: outcome.invalidated,
              skipped: outcome.skipped,
              failed: outcome.failed,
            },
          });
          return res;
        } catch (e) {
          const message = (e as Error).message;
          logger.error({ event: "oura_token_refresh_cron.failed", error: message });
          const res = secureJsonResponse({ ok: false, error: message }, 500);
          await recordAdminAudit({
            ...auditBase,
            outcome: "internal_error",
            statusCode: 500,
            errorMessage: message,
          });
          return res;
        }
      },
    },
  },
});
