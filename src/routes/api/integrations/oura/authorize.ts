// Oura OAuth initiation. Issues a single-use handshake record in
// public.oauth_state and returns the authorize URL the client should
// redirect to. Secrets stay server-side; state + PKCE verifier are
// generated here so the callback can validate both CSRF and the
// authorization-code exchange.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildAuthUrl, getOuraEnv } from "@/lib/providers/oura";

const PROVIDER = "oura" as const;
const HANDSHAKE_TTL_MS = 10 * 60 * 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// base64url without padding — RFC 7636.
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafe(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export const Route = createFileRoute("/api/integrations/oura/authorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Auth — same pattern as /sync.
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return jsonResponse({ error: "Missing bearer token" }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return jsonResponse({ error: "Empty bearer token" }, 401);

        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          return jsonResponse({ error: "Invalid token" }, 401);
        }
        const userId = userData.user.id;

        // 2. Config check. Fail clearly if Oura is not configured so the
        //    client sees a real error, not a broken redirect.
        try {
          getOuraEnv();
        } catch (e) {
          return jsonResponse({ error: (e as Error).message }, 503);
        }

        // 3. Generate state + PKCE pair. The verifier stays server-side;
        //    the challenge goes up to Oura.
        const state = randomUrlSafe(32);
        const codeVerifier = randomUrlSafe(64);
        const codeChallenge = await sha256Base64Url(codeVerifier);

        // 4. Persist the handshake. 10-minute TTL matches a short user
        //    consent window; the callback deletes the row on use.
        const admin = supabaseAdmin as unknown as { from: (t: string) => any };
        const expiresAt = new Date(Date.now() + HANDSHAKE_TTL_MS).toISOString();
        const { error: insErr } = await admin.from("oauth_state").insert({
          state,
          user_id: userId,
          provider: PROVIDER,
          code_verifier: codeVerifier,
          expires_at: expiresAt,
        });
        if (insErr) {
          return jsonResponse({ error: `oauth_state insert failed: ${insErr.message}` }, 500);
        }

        // 5. Build the authorize URL server-side (no client secret leaked).
        let authorizeUrl: string;
        try {
          authorizeUrl = buildAuthUrl({ state, codeChallenge });
        } catch (e) {
          // If the URL can't be built, roll back the handshake so expired
          // orphan rows don't accumulate faster than the TTL.
          await admin.from("oauth_state").delete().eq("state", state);
          return jsonResponse({ error: (e as Error).message }, 500);
        }

        return jsonResponse({ ok: true, authorizeUrl });
      },
    },
  },
});
