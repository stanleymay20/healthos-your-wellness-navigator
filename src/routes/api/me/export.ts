// GET /api/me/export — returns the authenticated user's own data as a
// downloadable JSON bundle. Required for GDPR Article 15 / CCPA right
// of access. Bearer-authenticated, rate-limited, security-headed.
//
// What is exported: every table where the user owns rows.
// What is NOT exported (intentionally):
//   - device_oauth_tokens   — secret material, server-only by RLS design
//   - oauth_state           — transient OAuth handshake records
//   - sync_runs             — operational data, not user-owned
//   - admin_audit_log       — operational data, not user-owned
//
// Failure model: each table query is best-effort. If one fails the
// others still come back and a per-table error is surfaced under
// `errors`. The user then has *most* of their data plus a clear note
// about what's missing — strictly better than failing the whole
// export, given GDPR's right-of-access deadline.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { logger } from "@/lib/log/logger";

const RATE_LIMIT = 5;
const RATE_WINDOW_SEC = 3600;
const SCHEMA_VERSION = 1;

type AnyAdmin = { from: (t: string) => any };

async function fetchOwnRows(admin: AnyAdmin, table: string, userIdColumn: string, userId: string) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq(userIdColumn, userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchOwnSingleton(admin: AnyAdmin, table: string, userIdColumn: string, userId: string) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq(userIdColumn, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export const Route = createFileRoute("/api/me/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const callerIp = getClientIp(request);
        const limit = enforceRateLimit(`me_export:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          return secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return secureJsonResponse({ error: "Missing bearer token" }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return secureJsonResponse({ error: "Empty bearer token" }, 401);

        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          return secureJsonResponse({ error: "Invalid token" }, 401);
        }
        const userId = userData.user.id;
        const admin = supabaseAdmin as unknown as AnyAdmin;

        // Run all queries in parallel; one failure must not kill the rest.
        const tasks: Array<{
          key: string;
          run: () => Promise<unknown>;
        }> = [
          { key: "profile", run: () => fetchOwnSingleton(admin, "profiles", "id", userId) },
          {
            key: "user_preferences",
            run: () => fetchOwnSingleton(admin, "user_preferences", "user_id", userId),
          },
          { key: "health_logs", run: () => fetchOwnRows(admin, "health_logs", "user_id", userId) },
          { key: "health_scores", run: () => fetchOwnRows(admin, "health_scores", "user_id", userId) },
          { key: "insights", run: () => fetchOwnRows(admin, "insights", "user_id", userId) },
          { key: "recommendations", run: () => fetchOwnRows(admin, "recommendations", "user_id", userId) },
          {
            key: "device_connections",
            run: () => fetchOwnRows(admin, "device_connections", "user_id", userId),
          },
          {
            key: "wearable_daily_snapshots",
            run: () => fetchOwnRows(admin, "wearable_daily_snapshots", "user_id", userId),
          },
        ];

        const results = await Promise.allSettled(tasks.map((t) => t.run()));
        const data: Record<string, unknown> = {};
        const errors: Record<string, string> = {};
        results.forEach((res, idx) => {
          const key = tasks[idx].key;
          if (res.status === "fulfilled") {
            data[key] = res.value;
          } else {
            const message = (res.reason as Error).message ?? "unknown error";
            errors[key] = message;
            // Default to a shape the client can still rely on.
            data[key] = key === "profile" || key === "user_preferences" ? null : [];
            logger.warn({
              event: "me_export.partial_failure",
              userId,
              table: key,
              error: message,
            });
          }
        });

        const generatedAt = new Date().toISOString();
        const filename = `healthos-export-${generatedAt.slice(0, 10)}.json`;
        const body = {
          schema_version: SCHEMA_VERSION,
          generated_at: generatedAt,
          user: { id: userId, email: userData.user.email ?? null },
          data,
          ...(Object.keys(errors).length ? { errors } : {}),
        };

        return secureJsonResponse(body, 200, {
          "Content-Disposition": `attachment; filename="${filename}"`,
        });
      },
    },
  },
});
