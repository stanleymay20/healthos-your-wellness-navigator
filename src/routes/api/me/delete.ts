// Account deletion request + cancellation. GDPR Article 17 surface.
//
//   POST   /api/me/delete   → enqueues / re-arms a 30-day soft-delete.
//                              The user's data is NOT touched here.
//                              Body: { confirm: true } required.
//   DELETE /api/me/delete   → cancels a pending deletion.
//
// A separate worker (future phase) sweeps rows whose scheduled_for has
// passed and performs the hard delete. Until that runs, the user can
// still log in and reverse the request.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { logger } from "@/lib/log/logger";

const RATE_LIMIT = 3;
const RATE_WINDOW_SEC = 3600;
const GRACE_DAYS = 30;

type AnyAdmin = { from: (t: string) => any };

async function authenticate(request: Request): Promise<
  | { userId: string }
  | { error: Response }
> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { error: secureJsonResponse({ error: "Missing bearer token" }, 401) };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { error: secureJsonResponse({ error: "Empty bearer token" }, 401) };
  }
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user) {
    return { error: secureJsonResponse({ error: "Invalid token" }, 401) };
  }
  return { userId: userData.user.id };
}

export const Route = createFileRoute("/api/me/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const limit = enforceRateLimit(`me_delete:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          return secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
        }

        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const userId = auth.userId;

        // Require explicit confirmation in the body so accidental
        // navigation / curl can't enqueue a deletion.
        let body: { confirm?: unknown };
        try {
          const text = await request.text();
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          return secureJsonResponse({ error: "Invalid JSON body" }, 400);
        }
        if (body.confirm !== true) {
          return secureJsonResponse(
            { error: "Confirmation required: send { confirm: true }" },
            400,
          );
        }

        const admin = supabaseAdmin as unknown as AnyAdmin;
        const now = new Date();
        const scheduledFor = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);

        // Upsert: re-requesting deletion resets the 30-day clock and
        // clears any prior cancelled_at flag.
        const { error: upsertErr } = await admin.from("account_deletions").upsert(
          {
            user_id: userId,
            requested_at: now.toISOString(),
            scheduled_for: scheduledFor.toISOString(),
            requester_ip: callerIp,
            cancelled_at: null,
            executed_at: null,
          },
          { onConflict: "user_id" },
        );
        if (upsertErr) {
          logger.error({
            event: "me_delete.enqueue_failed",
            userId,
            error: upsertErr.message,
          });
          return secureJsonResponse(
            { error: "Could not schedule deletion" },
            500,
          );
        }

        logger.info({
          event: "me_delete.enqueued",
          userId,
          scheduled_for: scheduledFor.toISOString(),
          requester_ip: callerIp,
        });
        return secureJsonResponse({
          ok: true,
          scheduledFor: scheduledFor.toISOString(),
        });
      },

      DELETE: async ({ request }) => {
        const callerIp = getClientIp(request);
        const limit = enforceRateLimit(`me_delete_cancel:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          return secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
        }

        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const userId = auth.userId;

        const admin = supabaseAdmin as unknown as AnyAdmin;
        // Only flag rows that haven't been hard-deleted already (executed_at
        // null). If executed_at is set, the cascade already removed all of
        // the user's data and we shouldn't pretend otherwise.
        const { error: updateErr, data } = await admin
          .from("account_deletions")
          .update({ cancelled_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("executed_at", null)
          .select("user_id")
          .maybeSingle();
        if (updateErr) {
          logger.error({
            event: "me_delete.cancel_failed",
            userId,
            error: updateErr.message,
          });
          return secureJsonResponse(
            { error: "Could not cancel deletion" },
            500,
          );
        }

        logger.info({
          event: "me_delete.cancelled",
          userId,
          had_pending_row: !!data,
        });
        return secureJsonResponse({ ok: true, cancelled: !!data });
      },
    },
  },
});
