import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabaseAdminExtended } from "@/integrations/supabase/client.extended.server";
import { getRequestId, recordServerError } from "@/lib/logger.server";
import { buildAuthUrl } from "@/lib/providers/oura";

const PROVIDER = "oura" as const;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function s256Challenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export const Route = createFileRoute("/api/integrations/oura/authorize")({
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
        const userId = userData.user.id;

        // Generate PKCE + state. 32 bytes of entropy each.
        const state = randomUrlSafe(32);
        const codeVerifier = randomUrlSafe(64);
        const codeChallenge = await s256Challenge(codeVerifier);
        const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

        const { error: insertErr } = await supabaseAdminExtended.from("oauth_state").insert({
          state,
          user_id: userId,
          provider: PROVIDER,
          code_verifier: codeVerifier,
          expires_at: expiresAt,
        });
        if (insertErr) {
          await recordServerError({
            requestId,
            userId,
            route: "/api/integrations/oura/authorize",
            action: "oauth_state_insert",
            error: insertErr,
          });
          return jsonResponse({ error: `state persist failed: ${insertErr.message}`, requestId }, 500);
        }

        let url: string;
        try {
          url = buildAuthUrl({ state, codeChallenge });
        } catch (e) {
          // env vars missing — clean up the orphan state row.
          await supabaseAdminExtended.from("oauth_state").delete().eq("state", state);
          await recordServerError({
            requestId,
            userId,
            route: "/api/integrations/oura/authorize",
            action: "oura_auth_url_build",
            error: e,
          });
          return jsonResponse({ error: (e as Error).message, requestId }, 500);
        }

        return jsonResponse({ url });
      },
    },
  },
});
