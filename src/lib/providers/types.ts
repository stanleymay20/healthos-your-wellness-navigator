export type ProviderId = "oura";

export type ProviderDefinition = {
  id: ProviderId;
  name: string;
  authStyle: "oauth2";
  scopes: readonly string[];
};

export type OAuthTokenRecord = {
  user_id: string;
  provider: ProviderId;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  account_id: string | null;
};

export type SyncResult = {
  provider: ProviderId;
  syncedThrough: string | null;
  error?: string;
};
