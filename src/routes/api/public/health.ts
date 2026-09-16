import { createFileRoute } from "@tanstack/react-router";
import { getRequestId, recordServerError } from "@/lib/logger.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = getRequestId(request);
        const startedAt = Date.now();

        try {
          const { error } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true });
          if (error) throw error;

          return jsonResponse({
            ok: true,
            requestId,
            checks: {
              app: "ok",
              database: "ok",
              serverSecrets: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "missing",
            },
            latencyMs: Date.now() - startedAt,
          });
        } catch (e) {
          await recordServerError({
            requestId,
            route: "/api/public/health",
            action: "health_check",
            error: e,
          });
          return jsonResponse({
            ok: false,
            requestId,
            checks: { app: "ok", database: "error" },
            latencyMs: Date.now() - startedAt,
          }, 503);
        }
      },
    },
  },
});
