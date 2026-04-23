import type { OAuthTokenRecord, ProviderDefinition, SyncResult } from "./types";

export type OuraTokenResponse = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
};

export const OURA: ProviderDefinition = {
  id: "oura",
  name: "Oura Ring",
  authStyle: "oauth2",
  scopes: ["daily", "heartrate", "personal", "workout", "session"],
};

// Authorization endpoint — public, safe to know client-side.
export const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";

// Token / API base URLs — used by server code only.
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
export const OURA_API_BASE = "https://api.ouraring.com/v2";

export type OuraEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

// Server-only: reads from process.env. Throws a clear error until configured.
export function getOuraEnv(): OuraEnv {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = process.env.OURA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Oura OAuth not configured. Set OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_REDIRECT_URI.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// Phase 8: placeholders only. Implementations land in a later phase.
export function buildAuthUrl(_args: { state: string; codeChallenge: string }): string {
  throw new Error("Oura OAuth redirect not implemented yet.");
}

// Server-only. Exchanges an authorization code for an access/refresh token
// pair using basic-auth with the Oura client secret. Returns just the token
// fields; persistence / user association happens in the callback handler.
export async function exchangeCodeForTokens(args: {
  code: string;
  codeVerifier?: string;
}): Promise<OuraTokenResponse> {
  const env = getOuraEnv();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: env.redirectUri,
  });
  if (args.codeVerifier) params.set("code_verifier", args.codeVerifier);

  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oura token exchange failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
    scope: json.scope ?? null,
  };
}

// Server-only. Exchanges a refresh token for a fresh access/refresh pair.
// Oura rotates refresh tokens, so the returned refresh_token (when present)
// must be persisted in place of the old one. Distinguishes a dead refresh
// token (401/400 from Oura) from transient failures via RefreshTokenInvalidError.
export class RefreshTokenInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshTokenInvalidError";
  }
}

export async function refreshAccessToken(args: {
  refreshToken: string;
}): Promise<OuraTokenResponse> {
  const env = getOuraEnv();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  const basic = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });
  if (res.status === 400 || res.status === 401) {
    const text = await res.text().catch(() => "");
    throw new RefreshTokenInvalidError(
      `Oura refresh token rejected (${res.status}): ${text || res.statusText}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oura refresh failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null,
    scope: json.scope ?? null,
  };
}

export async function syncRecent(_token: OAuthTokenRecord): Promise<SyncResult> {
  throw new Error("Oura sync not implemented yet.");
}
