// Scheduled / background Oura sync trigger. Not user-facing.
//
// Gated by SYNC_CRON_SECRET (separate from BACKFILL_ADMIN_SECRET so the
// two operational levers can be rotated independently). Fail-closed 503
// when the secret is not configured.

import { createFileRoute } from "@tanstack/react-router";
import { runScheduledOuraSync } from "@/lib/providers/oura-sync-batch.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/oura-sync-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.SYNC_CRON_SECRET;
        if (!cronSecret) {
          return jsonResponse(
            { error: "Scheduled sync disabled: SYNC_CRON_SECRET not configured" },
            503,
          );
        }
        const provided = request.headers.get("x-sync-secret");
        if (!provided || provided !== cronSecret) {
          return jsonResponse({ error: "Forbidden" }, 403);
        }

        try {
          const outcome = await runScheduledOuraSync();
          return jsonResponse({ ok: true, ...outcome });
        } catch (e) {
          return jsonResponse(
            { ok: false, error: (e as Error).message },
            500,
          );
        }
      },
    },
  },
});
