// Read-only parity report between live-written health_scores and
// snapshot-derived scores for a user/date window. Operational. Makes no
// writes (other than the audit-log row).
//
// Phase 27: secret rotation isolation. This route now requires
// PARITY_ADMIN_SECRET (separate from BACKFILL_ADMIN_SECRET) so rotating
// one operator credential doesn't disable the other tool.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { compareScoreParityForUser } from "@/lib/scoring/parity.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import {
  digestPayload,
  recordAdminAudit,
  type AdminAuditFields,
} from "@/lib/audit/admin.server";

const ROUTE = "POST /api/admin/score-parity";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 180;
const DEFAULT_SAMPLE_LIMIT = 20;
const MAX_SAMPLE_LIMIT = 200;
const RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 3600;

function daysBetween(start: string, end: string): number {
  return Math.floor((Date.parse(end) - Date.parse(start)) / (1000 * 60 * 60 * 24));
}

export const Route = createFileRoute("/api/admin/score-parity")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const auditBase: Pick<AdminAuditFields, "route" | "callerIp"> = {
          route: ROUTE,
          callerIp,
        };

        const limit = enforceRateLimit(`parity:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          const res = secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
          await recordAdminAudit({ ...auditBase, outcome: "rate_limited", statusCode: 429 });
          return res;
        }

        const adminSecret = process.env.PARITY_ADMIN_SECRET;
        if (!adminSecret) {
          const res = secureJsonResponse(
            { error: "Score parity disabled: PARITY_ADMIN_SECRET not configured" },
            503,
          );
          await recordAdminAudit({ ...auditBase, outcome: "config_missing", statusCode: 503 });
          return res;
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          const res = secureJsonResponse({ error: "Missing bearer token" }, 401);
          await recordAdminAudit({ ...auditBase, outcome: "auth_failed", statusCode: 401 });
          return res;
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) {
          const res = secureJsonResponse({ error: "Empty bearer token" }, 401);
          await recordAdminAudit({ ...auditBase, outcome: "auth_failed", statusCode: 401 });
          return res;
        }
        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          const res = secureJsonResponse({ error: "Invalid token" }, 401);
          await recordAdminAudit({ ...auditBase, outcome: "auth_failed", statusCode: 401 });
          return res;
        }
        const callerId = userData.user.id;
        const secretHeader = request.headers.get("x-parity-secret");
        const isAdmin = !!secretHeader && secretHeader === adminSecret;

        const rawBody = await request.text().catch(() => "");
        const payloadDigest = rawBody ? await digestPayload(rawBody) : null;

        let body: {
          startDate?: unknown;
          endDate?: unknown;
          provider?: unknown;
          userId?: unknown;
          sampleLimit?: unknown;
        };
        try {
          body = rawBody ? (JSON.parse(rawBody) as typeof body) : {};
        } catch {
          const res = secureJsonResponse({ error: "Invalid JSON body" }, 400);
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "validation_error",
            statusCode: 400,
            errorMessage: "Invalid JSON body",
          });
          return res;
        }

        const startDate = typeof body.startDate === "string" ? body.startDate : "";
        const endDate = typeof body.endDate === "string" ? body.endDate : "";
        if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
          const res = secureJsonResponse(
            { error: "startDate and endDate must be YYYY-MM-DD" },
            400,
          );
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "validation_error",
            statusCode: 400,
            errorMessage: "bad date format",
          });
          return res;
        }
        if (startDate > endDate) {
          const res = secureJsonResponse({ error: "startDate must be <= endDate" }, 400);
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "validation_error",
            statusCode: 400,
            errorMessage: "start > end",
          });
          return res;
        }
        if (daysBetween(startDate, endDate) > MAX_WINDOW_DAYS) {
          const res = secureJsonResponse(
            { error: `Window too large (>${MAX_WINDOW_DAYS} days)` },
            400,
          );
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "validation_error",
            statusCode: 400,
            errorMessage: "window too large",
          });
          return res;
        }

        const requestedUserId =
          typeof body.userId === "string" && body.userId.length > 0 ? body.userId : null;
        if (requestedUserId && requestedUserId !== callerId && !isAdmin) {
          const res = secureJsonResponse(
            { error: "Cross-user parity check requires admin secret" },
            403,
          );
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "forbidden",
            statusCode: 403,
            errorMessage: "cross-user without secret",
          });
          return res;
        }
        const targetUserId = requestedUserId ?? callerId;
        const provider = typeof body.provider === "string" ? body.provider : "oura";

        let sampleLimit = DEFAULT_SAMPLE_LIMIT;
        if (typeof body.sampleLimit === "number" && Number.isFinite(body.sampleLimit)) {
          sampleLimit = Math.max(
            0,
            Math.min(Math.trunc(body.sampleLimit), MAX_SAMPLE_LIMIT),
          );
        }

        try {
          const report = await compareScoreParityForUser({
            userId: targetUserId,
            startDate,
            endDate,
            provider,
            sampleLimit,
          });
          const res = secureJsonResponse({
            ok: true,
            userId: targetUserId,
            provider,
            startDate,
            endDate,
            ...report,
          });
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "ok",
            statusCode: 200,
            details: {
              targetUserId,
              provider,
              comparedDays: report.comparedDays,
              matchingDays: report.matchingDays,
              mismatchedDays: report.mismatchedDays,
              isAdminCall: isAdmin,
            },
          });
          return res;
        } catch (e) {
          const message = (e as Error).message;
          const res = secureJsonResponse({ ok: false, error: message }, 500);
          await recordAdminAudit({
            ...auditBase,
            callerUserId: callerId,
            payloadDigest,
            outcome: "internal_error",
            statusCode: 500,
            errorMessage: message,
            details: { targetUserId, provider },
          });
          return res;
        }
      },
    },
  },
});
