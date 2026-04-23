// Server-only. Orchestrates a minimal Oura → HealthOS sync for a single user.
// No background jobs, no refresh-token flow, no health_logs writes — those
// are intentional follow-ups.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { OURA_API_BASE } from "./oura";

const PROVIDER = "oura" as const;
const DEFAULT_LOOKBACK_DAYS = 14;

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

type DailyPoint = { day: string; score: number | null };
type DailyResponse = { data?: Array<{ day: string; score?: number | null }> };

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
  return (json.data ?? []).map((d) => ({ day: d.day, score: d.score ?? null }));
}

function indexByDay(points: DailyPoint[]): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const p of points) m.set(p.day, p.score);
  return m;
}

function avgPresent(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
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
    // 2. Load the stored access token. Refresh flow is intentionally out of
    //    scope for this phase — if the token is bad, we surface that and
    //    leave it to the user to reconnect.
    const { data: tokenRow, error: tokenErr } = await admin
      .from("device_oauth_tokens")
      .select("access_token")
      .eq("user_id", userId)
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (tokenErr) throw new Error(`token lookup failed: ${tokenErr.message}`);
    if (!tokenRow?.access_token) {
      throw new TokenRevokedError("No Oura connection found for this user.");
    }
    const accessToken = tokenRow.access_token as string;

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

    // 4. Pull the three daily collections in parallel.
    const [sleep, readiness, activity] = await Promise.all([
      fetchDaily(accessToken, "daily_sleep", startDate, endDate),
      fetchDaily(accessToken, "daily_readiness", startDate, endDate),
      fetchDaily(accessToken, "daily_activity", startDate, endDate),
    ]);

    const sleepByDay = indexByDay(sleep);
    const readyByDay = indexByDay(readiness);
    const actByDay = indexByDay(activity);

    const allDays = new Set<string>([
      ...sleepByDay.keys(),
      ...readyByDay.keys(),
      ...actByDay.keys(),
    ]);

    // 5. Upsert one health_scores row per day with at least one signal.
    //    UNIQUE (user_id, score_date) makes upsert idempotent.
    const rows: Array<Record<string, unknown>> = [];
    for (const day of allDays) {
      const sleepScore = sleepByDay.get(day) ?? null;
      const recoveryScore = readyByDay.get(day) ?? null;
      const activityScore = actByDay.get(day) ?? null;
      const overall = avgPresent([sleepScore, recoveryScore, activityScore]);
      if (overall === null) continue;
      rows.push({
        user_id: userId,
        score_date: day,
        overall_score: overall,
        sleep_score: sleepScore,
        recovery_score: recoveryScore,
        activity_score: activityScore,
      });
    }

    if (rows.length > 0) {
      const { error: upsertErr } = await admin
        .from("health_scores")
        .upsert(rows, { onConflict: "user_id,score_date" });
      if (upsertErr) throw new Error(`health_scores upsert failed: ${upsertErr.message}`);
    }

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

    return { daysWritten: rows.length, syncedThrough: endDate };
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
