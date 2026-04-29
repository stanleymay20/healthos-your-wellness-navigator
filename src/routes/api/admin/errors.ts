import { createFileRoute } from "@tanstack/react-router";
import { getRequestId, recordServerError } from "@/lib/logger.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_LIMIT = 100;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/admin/errors")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = getRequestId(request);
        const adminSecret = process.env.BACKFILL_ADMIN_SECRET;
        if (!adminSecret) return jsonResponse({ error: "Diagnostics disabled", requestId }, 503);

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return jsonResponse({ error: "Missing bearer token", requestId }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return jsonResponse({ error: "Empty bearer token", requestId }, 401);

        const secretHeader = request.headers.get("x-backfill-secret");
        if (!secretHeader || secretHeader !== adminSecret) {
          return jsonResponse({ error: "Admin secret required", requestId }, 403);
        }

        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) return jsonResponse({ error: "Invalid token", requestId }, 401);

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), MAX_LIMIT);
        const route = url.searchParams.get("route");
        const severity = url.searchParams.get("severity");

        try {
          const admin = supabaseAdmin as unknown as { from: (table: string) => any };
          let query = admin
            .from("app_errors")
            .select("id, request_id, user_id, route, action, severity, message, metadata, created_at")
            .order("created_at", { ascending: false })
            .limit(limit);

          if (route) query = query.eq("route", route);
          if (severity) query = query.eq("severity", severity);

          const { data, error } = await query;
          if (error) throw error;

          return jsonResponse({ ok: true, requestId, errors: data ?? [] });
        } catch (e) {
          await recordServerError({
            requestId,
            userId: userData.user.id,
            route: "/api/admin/errors",
            action: "diagnostics_errors_read",
            error: e,
          });
          return jsonResponse({ ok: false, requestId, error: (e as Error).message }, 500);
        }
      },
    },
  },
});