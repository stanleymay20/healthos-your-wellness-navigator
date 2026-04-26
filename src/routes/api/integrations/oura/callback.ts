import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeCodeForTokens } from "@/lib/providers/oura";
import { logger } from "@/lib/log/logger";
import {
  getClientIp,
  secureJsonResponse,
  secureRedirect,
  secureTextResponse,
} from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";

const PROVIDER = "oura" as const;
const RATE_LIMIT = 30;
const RATE_WINDOW_SEC = 60;

function redirectToDevices(reason: string): Response {
  return secureRedirect(`/devices?oauth=${encodeURIComponent(reason)}`);
}

function badRequest(reason: string): Response {
  return secureTextResponse(`OAuth callback error: ${reason}`, 400);
}

export const Route = createFileRoute("/api/integrations/oura/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limit = enforceRateLimit(`oauth_cb:${getClientIp(request)}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          return secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        if (oauthError) {
          // User denied or upstream rejected. Don't write a fake row.
          logger.warn({
            event: "oura_oauth.callback.denied",
            provider: PROVIDER,
            reason: oauthError,
          });
          return redirectToDevices(`denied:${oauthError}`);
        }
        if (!state) return badRequest("missing state");
        if (!code) return badRequest("missing code");

        // Cast to bypass generated-types lookup for tables not yet in
        // src/integrations/supabase/types.ts. This is a server-only file.
        const admin = supabaseAdmin as unknown as {
          from: (t: string) => any;
        };

        // 1. Look up the pending handshake. Single-use: delete after use.
        const { data: stateRow, error: stateErr } = await admin
          .from("oauth_state")
          .select("user_id, provider, code_verifier, expires_at")
          .eq("state", state)
          .maybeSingle();

        if (stateErr) {
          return secureTextResponse(`oauth_state lookup failed: ${stateErr.message}`, 500);
        }
        if (!stateRow) return badRequest("state not found");
        if (stateRow.provider !== PROVIDER) return badRequest("state provider mismatch");
        if (new Date(stateRow.expires_at as string).getTime() < Date.now()) {
          await admin.from("oauth_state").delete().eq("state", state);
          return badRequest("state expired");
        }

        const userId = stateRow.user_id as string;

        // 2. Exchange code for tokens. Server-only — uses OURA_CLIENT_SECRET.
        let tokens;
        try {
          tokens = await exchangeCodeForTokens({
            code,
            codeVerifier: (stateRow.code_verifier as string | null) ?? undefined,
          });
        } catch (e) {
          // Surface the failure on the connection row so the user sees it,
          // and consume the state so it can't be retried with the same code.
          logger.error({
            event: "oura_oauth.callback.token_exchange_failed",
            userId,
            provider: PROVIDER,
            error: (e as Error).message,
          });
          await admin.from("oauth_state").delete().eq("state", state);
          await admin.from("device_connections").upsert(
            {
              user_id: userId,
              provider: PROVIDER,
              status: "disconnected",
              sync_error: (e as Error).message.slice(0, 500),
            },
            { onConflict: "user_id,provider" },
          );
          return redirectToDevices("error:token_exchange");
        }

        // 3. Persist tokens (server-only table, no RLS policies for authenticated).
        const { error: tokenErr } = await admin.from("device_oauth_tokens").upsert(
          {
            user_id: userId,
            provider: PROVIDER,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at,
            scope: tokens.scope,
          },
          { onConflict: "user_id,provider" },
        );
        if (tokenErr) {
          return secureTextResponse(`token persist failed: ${tokenErr.message}`, 500);
        }

        // 4. Mark the connection live. last_synced_at stays null until a real
        // sync runs in a later phase — we do not fabricate sync state.
        const { error: connErr } = await admin.from("device_connections").upsert(
          {
            user_id: userId,
            provider: PROVIDER,
            status: "connected",
            sync_error: null,
            scope: tokens.scope,
          },
          { onConflict: "user_id,provider" },
        );
        if (connErr) {
          return secureTextResponse(`connection update failed: ${connErr.message}`, 500);
        }

        // 5. Burn the handshake row so the same state can't be reused.
        await admin.from("oauth_state").delete().eq("state", state);

        return redirectToDevices("connected");
      },
    },
  },
});
