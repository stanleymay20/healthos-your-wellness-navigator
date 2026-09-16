import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./client.server";
import type { Database, Json } from "./types";

type BasePublic = Database["public"];
type BaseDeviceConnection = BasePublic["Tables"]["device_connections"];
type DeviceStatus = BasePublic["Enums"]["device_status"] | "syncing";

type ExtendedDeviceConnections = {
  Row: Omit<BaseDeviceConnection["Row"], "status"> & {
    status: DeviceStatus;
    scope: string | null;
    sync_error: string | null;
    synced_through: string | null;
  };
  Insert: Omit<BaseDeviceConnection["Insert"], "status"> & {
    status?: DeviceStatus;
    scope?: string | null;
    sync_error?: string | null;
    synced_through?: string | null;
  };
  Update: Omit<BaseDeviceConnection["Update"], "status"> & {
    status?: DeviceStatus;
    scope?: string | null;
    sync_error?: string | null;
    synced_through?: string | null;
  };
  Relationships: BaseDeviceConnection["Relationships"];
};

type OAuthStateTable = {
  Row: {
    state: string;
    user_id: string;
    provider: string;
    code_verifier: string | null;
    created_at: string;
    expires_at: string;
  };
  Insert: {
    state: string;
    user_id: string;
    provider: string;
    code_verifier?: string | null;
    created_at?: string;
    expires_at: string;
  };
  Update: {
    state?: string;
    user_id?: string;
    provider?: string;
    code_verifier?: string | null;
    created_at?: string;
    expires_at?: string;
  };
  Relationships: [];
};

type DeviceOAuthTokensTable = {
  Row: {
    id: string;
    user_id: string;
    provider: string;
    access_token: string;
    refresh_token: string | null;
    expires_at: string | null;
    scope: string | null;
    account_id: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    provider: string;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    scope?: string | null;
    account_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    provider?: string;
    access_token?: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    scope?: string | null;
    account_id?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

type WearableDailySnapshotsTable = {
  Row: {
    id: string;
    user_id: string;
    provider: string;
    record_date: string;
    record_type: string;
    score: number | null;
    payload: Json;
    fetched_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    provider: string;
    record_date: string;
    record_type: string;
    score?: number | null;
    payload: Json;
    fetched_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    provider?: string;
    record_date?: string;
    record_type?: string;
    score?: number | null;
    payload?: Json;
    fetched_at?: string;
  };
  Relationships: [];
};

type ExtendedDatabase = Omit<Database, "public"> & {
  public: Omit<BasePublic, "Tables" | "Enums"> & {
    Tables: Omit<BasePublic["Tables"], "device_connections"> & {
      device_connections: ExtendedDeviceConnections;
      oauth_state: OAuthStateTable;
      device_oauth_tokens: DeviceOAuthTokensTable;
      wearable_daily_snapshots: WearableDailySnapshotsTable;
    };
    Enums: Omit<BasePublic["Enums"], "device_status"> & {
      device_status: DeviceStatus;
    };
  };
};

/**
 * Server-only Supabase client typed with schema additions represented by
 * migrations newer than the checked-in generated types file.
 *
 * Regenerate `types.ts` from the current Supabase schema when database access
 * is available, then this compatibility layer can be removed.
 */
export const supabaseAdminExtended =
  supabaseAdmin as unknown as SupabaseClient<ExtendedDatabase>;
