import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncOuraForUser } from "@/lib/providers/oura-sync.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";

const RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 60;

export const Route = createFileRoute("/api/integrations/oura/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Per-IP rate limit before any auth work.
        const limit = enforceRateLimit(`sync:${getClientIp(request)}`, RATE_LIMIT, RATE_WINDOW_SEC);
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

        try {
          const outcome = await syncOuraForUser(userData.user.id);
          return secureJsonResponse({ ok: true, ...outcome });
        } catch (e) {
          return secureJsonResponse({ ok: false, error: (e as Error).message }, 502);
        }
      },
    },
  },
});
