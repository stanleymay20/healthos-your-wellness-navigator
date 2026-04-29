import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestId, recordServerError } from "@/lib/logger.server";
import { syncOuraForUser } from "@/lib/providers/oura-sync.server";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/integrations/oura/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return jsonResponse({ error: "Missing bearer token", requestId }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return jsonResponse({ error: "Empty bearer token", requestId }, 401);

        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          return jsonResponse({ error: "Invalid token", requestId }, 401);
        }

        try {
          const outcome = await syncOuraForUser(userData.user.id);
          return jsonResponse({ ok: true, requestId, ...outcome });
        } catch (e) {
          await recordServerError({
            requestId,
            userId: userData.user.id,
            route: "/api/integrations/oura/sync",
            action: "oura_sync",
            error: e,
          });
          return jsonResponse({ ok: false, requestId, error: (e as Error).message }, 502);
        }
      },
    },
  },
});
