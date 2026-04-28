// Scheduled / background Oura sync trigger. Not user-facing.
//
// Gated by SYNC_CRON_SECRET (separate from BACKFILL_ADMIN_SECRET and
// PARITY_ADMIN_SECRET so the three operator levers rotate independently).
// Fail-closed 503 when the secret is not configured.

import { createFileRoute } from "@tanstack/react-router";
import { runScheduledOuraSync } from "@/lib/providers/oura-sync-batch.server";
import { logger } from "@/lib/log/logger";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { recordAdminAudit, type AdminAuditFields } from "@/lib/audit/admin.server";

const ROUTE = "POST /api/admin/oura-sync-cron";
const RATE_LIMIT = 60;
const RATE_WINDOW_SEC = 3600;

export const Route = createFileRoute("/api/admin/oura-sync-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const auditBase: Pick<AdminAuditFields, "route" | "callerIp"> = {
          route: ROUTE,
          callerIp,
        };

        const limit = enforceRateLimit(`cron:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          const res = secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
          await recordAdminAudit({ ...auditBase, outcome: "rate_limited", statusCode: 429 });
          return res;
        }

        const cronSecret = process.env.SYNC_CRON_SECRET;
        if (!cronSecret) {
          const res = secureJsonResponse(
            { error: "Scheduled sync disabled: SYNC_CRON_SECRET not configured" },
            503,
          );
          await recordAdminAudit({ ...auditBase, outcome: "config_missing", statusCode: 503 });
          return res;
        }
        const provided = request.headers.get("x-sync-secret");
        if (!provided || provided !== cronSecret) {
          const res = secureJsonResponse({ error: "Forbidden" }, 403);
          await recordAdminAudit({ ...auditBase, outcome: "forbidden", statusCode: 403 });
          return res;
        }

        try {
          const outcome = await runScheduledOuraSync();
          logger.info({
            event: "oura_sync_cron.completed",
            usersScanned: outcome.usersScanned,
            usersSynced: outcome.usersSynced,
            usersSkipped: outcome.usersSkipped,
            usersFailed: outcome.usersFailed,
            runId: outcome.runId,
          });
          const res = secureJsonResponse({ ok: true, ...outcome });
          await recordAdminAudit({
            ...auditBase,
            outcome: "ok",
            statusCode: 200,
            details: {
              usersScanned: outcome.usersScanned,
              usersSynced: outcome.usersSynced,
              usersSkipped: outcome.usersSkipped,
              usersFailed: outcome.usersFailed,
              runId: outcome.runId,
            },
          });
          return res;
        } catch (e) {
          const message = (e as Error).message;
          logger.error({ event: "oura_sync_cron.failed", error: message });
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
