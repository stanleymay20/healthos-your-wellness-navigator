import type { OAuthTokenRecord, ProviderDefinition, SyncResult } from "./types";

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

export async function exchangeCodeForTokens(_args: {
  code: string;
  codeVerifier: string;
}): Promise<OAuthTokenRecord> {
  throw new Error("Oura token exchange not implemented yet.");
}

export async function refreshAccessToken(
  _token: OAuthTokenRecord,
): Promise<OAuthTokenRecord> {
  throw new Error("Oura token refresh not implemented yet.");
}

export async function syncRecent(_token: OAuthTokenRecord): Promise<SyncResult> {
  throw new Error("Oura sync not implemented yet.");
}
