// Controlled server-side backfill trigger. Not a public product feature:
// requires both a valid Supabase bearer token AND a shared admin secret
// header (BACKFILL_ADMIN_SECRET). When both are present, an operator can
// target any user_id; otherwise the call is scoped to the authenticated
// user. No UI surface, no cron — this is an on-demand operational tool
// until a future phase decides how to productize it.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestId, recordServerError } from "@/lib/logger.server";
import { backfillScoresFromSnapshots } from "@/lib/scoring/persist.server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 180;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function daysBetween(start: string, end: string): number {
  return Math.floor(
    (Date.parse(end) - Date.parse(start)) / (1000 * 60 * 60 * 24),
  );
}

export const Route = createFileRoute("/api/admin/backfill-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = getRequestId(request);
        const adminSecret = process.env.BACKFILL_ADMIN_SECRET;
        if (!adminSecret) {
          return jsonResponse(
            { error: "Backfill disabled: BACKFILL_ADMIN_SECRET not configured", requestId },
            503,
          );
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return jsonResponse({ error: "Missing bearer token", requestId }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return jsonResponse({ error: "Empty bearer token", requestId }, 401);

        const { data: userData, error: authErr } =
          await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          return jsonResponse({ error: "Invalid token", requestId }, 401);
        }
        const callerId = userData.user.id;

        const secretHeader = request.headers.get("x-backfill-secret");
        const isAdmin = !!secretHeader && secretHeader === adminSecret;

        let body: {
          startDate?: unknown;
          endDate?: unknown;
          provider?: unknown;
          userId?: unknown;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const startDate = typeof body.startDate === "string" ? body.startDate : "";
        const endDate = typeof body.endDate === "string" ? body.endDate : "";
        if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
          return jsonResponse(
            { error: "startDate and endDate must be YYYY-MM-DD" },
            400,
          );
        }
        if (startDate > endDate) {
          return jsonResponse(
            { error: "startDate must be <= endDate" },
            400,
          );
        }
        if (daysBetween(startDate, endDate) > MAX_WINDOW_DAYS) {
          return jsonResponse(
            { error: `Window too large (>${MAX_WINDOW_DAYS} days)` },
            400,
          );
        }

        const requestedUserId =
          typeof body.userId === "string" && body.userId.length > 0
            ? body.userId
            : null;
        if (requestedUserId && requestedUserId !== callerId && !isAdmin) {
          return jsonResponse(
            { error: "Cross-user backfill requires admin secret" },
            403,
          );
        }
        const targetUserId = requestedUserId ?? callerId;

        const provider = typeof body.provider === "string" ? body.provider : "oura";

        try {
          const outcome = await backfillScoresFromSnapshots({
            userId: targetUserId,
            startDate,
            endDate,
            provider,
          });
          return jsonResponse({
            ok: true,
            requestId,
            daysWritten: outcome.daysWritten,
            startDate,
            endDate,
            userId: targetUserId,
            provider,
          });
        } catch (e) {
          await recordServerError({
            requestId,
            userId: targetUserId,
            route: "/api/admin/backfill-scores",
            action: "score_backfill",
            error: e,
            metadata: { startDate, endDate, provider },
          });
          return jsonResponse(
            { ok: false, requestId, error: (e as Error).message },
            500,
          );
        }
      },
    },
  },
});
