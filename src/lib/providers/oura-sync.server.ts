// Server-only. Orchestrates a minimal Oura → HealthOS sync for a single user.
// No background jobs, no refresh-token flow, no health_logs writes — those
// are intentional follow-ups.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OURA_API_BASE,
  refreshAccessToken,
  RefreshTokenInvalidError,
} from "./oura";
import { deriveDailyScores, type SnapshotInput } from "@/lib/scoring/derive";
import { persistDerivedScores } from "@/lib/scoring/persist.server";

const PROVIDER = "oura" as const;
const DEFAULT_LOOKBACK_DAYS = 14;
// Refresh tokens whose access_token expires within this window, so we avoid
// burning a request on a near-dead token.
const EXPIRY_SKEW_MS = 60_000;

// Thrown only when the upstream signal clearly indicates the stored token
// is no longer usable (revoked, expired beyond refresh, scope stripped,
// user deleted on the provider side). Any other failure is considered
// transient and must not flip the connection to disconnected.
class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRevokedError";
  }
}

type OuraDailyRecord = Record<string, unknown> & {
  day?: unknown;
  score?: unknown;
};
type DailyPoint = { day: string; score: number | null; raw: OuraDailyRecord };
type DailyResponse = { data?: OuraDailyRecord[] };
type RecordType = "sleep" | "readiness" | "activity";

export type SyncOutcome = {
  daysWritten: number;
  syncedThrough: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchDaily(
  accessToken: string,
  endpoint: "daily_sleep" | "daily_readiness" | "daily_activity",
  startDate: string,
  endDate: string,
): Promise<DailyPoint[]> {
  const url = `${OURA_API_BASE}/usercollection/${endpoint}?start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new TokenRevokedError(
      `Oura access token rejected (${res.status}). Please reconnect.`,
    );
  }
  if (res.status === 429) {
    throw new Error("Oura rate limit hit (429). Try again later.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Oura ${endpoint} failed (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as DailyResponse;
  return (json.data ?? [])
    .filter((d) => typeof d.day === "string")
    .map((d) => ({
      day: d.day as string,
      score: typeof d.score === "number" ? d.score : null,
      raw: d,
    }));
}

function buildSnapshotRows(
  userId: string,
  recordType: RecordType,
  points: DailyPoint[],
): Array<Record<string, unknown>> {
  const fetchedAt = new Date().toISOString();
  return points.map((p) => ({
    user_id: userId,
    provider: PROVIDER,
    record_date: p.day,
    record_type: recordType,
    score: p.score,
    payload: p.raw,
    fetched_at: fetchedAt,
  }));
}

// Refreshes Oura tokens and persists the rotated pair. If the refresh token
// itself is dead, drops the stored token row and throws TokenRevokedError so
// the outer catch marks the connection disconnected — forcing a clean
// reconnect flow rather than looping on a bad refresh token.
async function refreshAndPersist(
  userId: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string | null }> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };
  let fresh;
  try {
    fresh = await refreshAccessToken({ refreshToken });
  } catch (err) {
    if (err instanceof RefreshTokenInvalidError) {
      await admin
        .from("device_oauth_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("provider", PROVIDER);
      throw new TokenRevokedError(
        "Oura refresh token is no longer valid. Please reconnect.",
      );
    }
    throw err;
  }
  const { error: updErr } = await admin
    .from("device_oauth_tokens")
    .update({
      access_token: fresh.access_token,
      refresh_token: fresh.refresh_token ?? refreshToken,
      expires_at: fresh.expires_at,
      scope: fresh.scope,
    })
    .eq("user_id", userId)
    .eq("provider", PROVIDER);
  if (updErr) throw new Error(`token refresh persist failed: ${updErr.message}`);
  return {
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token ?? refreshToken,
  };
}

export async function syncOuraForUser(userId: string): Promise<SyncOutcome> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };

  // 1. Mark the connection as syncing so the UI can reflect it. Errors here
  //    are non-fatal (the row may not exist if state is mid-rebuild).
  await admin
    .from("device_connections")
    .update({ status: "syncing", sync_error: null })
    .eq("user_id", userId)
    .eq("provider", PROVIDER);

  try {
    // 2. Load the stored token row. Pre-flight refresh if the access token
    //    is about to expire; surface reconnect when the refresh token itself
    //    is invalid.
    const { data: tokenRow, error: tokenErr } = await admin
      .from("device_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (tokenErr) throw new Error(`token lookup failed: ${tokenErr.message}`);
    if (!tokenRow?.access_token) {
      throw new TokenRevokedError("No Oura connection found for this user.");
    }
    let accessToken = tokenRow.access_token as string;
    let refreshToken = (tokenRow.refresh_token as string | null) ?? null;
    const expiresAt = (tokenRow.expires_at as string | null) ?? null;

    const expiresSoon =
      !!expiresAt && new Date(expiresAt).getTime() - Date.now() <= EXPIRY_SKEW_MS;
    if (expiresSoon && refreshToken) {
      const fresh = await refreshAndPersist(userId, refreshToken);
      accessToken = fresh.access_token;
      refreshToken = fresh.refresh_token;
    }

    // 3. Determine the date window. Use synced_through as the start cursor;
    //    fall back to a short lookback for the first sync.
    const { data: connRow } = await admin
      .from("device_connections")
      .select("synced_through")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    const today = new Date();
    const endDate = isoDate(today);
    let startDate: string;
    if (connRow?.synced_through) {
      startDate = connRow.synced_through as string;
    } else {
      const back = new Date(today);
      back.setDate(back.getDate() - DEFAULT_LOOKBACK_DAYS);
      startDate = isoDate(back);
    }

    // 4. Pull the three daily collections in parallel. If the token has
     //   been revoked provider-side we may hit 401 mid-flight — refresh
     //   once and retry the whole batch.
    const pullAll = (tok: string) => Promise.all([
      fetchDaily(tok, "daily_sleep", startDate, endDate),
      fetchDaily(tok, "daily_readiness", startDate, endDate),
      fetchDaily(tok, "daily_activity", startDate, endDate),
    ]);

    let sleep, readiness, activity;
    try {
      [sleep, readiness, activity] = await pullAll(accessToken);
    } catch (err) {
      if (err instanceof TokenRevokedError && refreshToken) {
        const fresh = await refreshAndPersist(userId, refreshToken);
        accessToken = fresh.access_token;
        refreshToken = fresh.refresh_token;
        [sleep, readiness, activity] = await pullAll(accessToken);
      } else {
        throw err;
      }
    }

    // 5a. Persist raw snapshots for every fetched day, regardless of whether
    //     we can compute a health_scores row from them. This is a dual-write
    //     alongside the existing health_scores upsert — later phases can
    //     derive scores from these snapshots rather than the live API.
    const snapshotRows = [
      ...buildSnapshotRows(userId, "sleep", sleep),
      ...buildSnapshotRows(userId, "readiness", readiness),
      ...buildSnapshotRows(userId, "activity", activity),
    ];
    if (snapshotRows.length > 0) {
      const { error: snapErr } = await admin
        .from("wearable_daily_snapshots")
        .upsert(snapshotRows, {
          onConflict: "user_id,provider,record_date,record_type",
        });
      if (snapErr) throw new Error(`snapshot upsert failed: ${snapErr.message}`);
    }

    // 5. Derive health_scores rows via the shared pure rule, then delegate
    //    persistence to persistDerivedScores — the same writer used by the
    //    backfill path. Behavior is unchanged: same upsert key, same
    //    idempotency, same error shape. This removes the duplicated inline
    //    upsert from the live sync.
    const derivationInputs: SnapshotInput[] = snapshotRows.map((r) => ({
      record_date: r.record_date as string,
      record_type: r.record_type as SnapshotInput["record_type"],
      score: (r.score as number | null) ?? null,
    }));
    const derived = deriveDailyScores(derivationInputs);
    const { daysWritten } = await persistDerivedScores(userId, derived);

    // 6. Mark success.
    const { error: connUpdateErr } = await admin
      .from("device_connections")
      .update({
        status: "connected",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
        synced_through: endDate,
      })
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    if (connUpdateErr) throw new Error(`connection update failed: ${connUpdateErr.message}`);

    return { daysWritten, syncedThrough: endDate };
  } catch (e) {
    // 7. Only flip to disconnected when the token itself is the problem
    //    (401/403 from Oura, or the row is gone). Everything else — network
    //    hiccups, 5xx, 429 rate limits, DB errors — is transient: keep the
    //    connection logically connected, record the error, and leave
    //    last_synced_at untouched so the user can see "last success" state.
    const message = (e as Error).message.slice(0, 500);
    const tokenProblem = e instanceof TokenRevokedError;
    await admin
      .from("device_connections")
      .update({
        status: tokenProblem ? "disconnected" : "connected",
        sync_error: message,
      })
      .eq("user_id", userId)
      .eq("provider", PROVIDER);
    throw e;
  }
}
