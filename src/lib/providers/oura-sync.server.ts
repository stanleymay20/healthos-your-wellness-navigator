// Server-only. Orchestrates a minimal Oura → HealthOS sync for a single user.

import { supabaseAdminExtended } from "@/integrations/supabase/client.extended.server";
import type { Json } from "@/integrations/supabase/types";
import {
  OURA_API_BASE,
  refreshAccessToken,
  RefreshTokenInvalidError,
} from "./oura";
import { deriveDailyScores, type SnapshotInput } from "@/lib/scoring/derive";
import { persistDerivedScores } from "@/lib/scoring/persist.server";
import { generateInsights } from "@/lib/insights/generate";

const PROVIDER = "oura" as const;
const DEFAULT_LOOKBACK_DAYS = 14;
const EXPIRY_SKEW_MS = 60_000;

type InsightTone = "positive" | "warning" | "neutral";
type InsightLevel = "low" | "medium" | "high";
const SYNC_INSIGHT_CATALOG: Record<
  string,
  { description: string; type: InsightTone; severity: InsightLevel }
> = {
  "Your recovery is low. Prioritize rest today.": {
    description: "Latest overall score is below 50. Consider a lighter day and earlier wind-down.",
    type: "warning",
    severity: "high",
  },
  "Your sleep quality dropped. Consider earlier sleep.": {
    description: "Sleep score fell below 60. Protecting an earlier wind-down tonight can rebuild the baseline.",
    type: "warning",
    severity: "medium",
  },
  "Low activity detected. Try light movement today.": {
    description: "Activity score is below 50. A short walk or mobility session can lift today's signal.",
    type: "warning",
    severity: "medium",
  },
  "You're improving. Keep your routine consistent.": {
    description: "Overall score improved versus the previous day. Consistency is compounding.",
    type: "positive",
    severity: "low",
  },
};

class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRevokedError";
  }
}

type OuraDailyRecord = Record<string, Json | undefined> & {
  day?: Json;
  score?: Json;
};
type DailyPoint = { day: string; score: number | null; raw: OuraDailyRecord };
type DailyResponse = { data?: OuraDailyRecord[] };
type RecordType = "sleep" | "readiness" | "activity";
type SnapshotInsert = {
  user_id: string;
  provider: string;
  record_date: string;
  record_type: RecordType;
  score: number | null;
  payload: Json;
  fetched_at: string;
};

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
): SnapshotInsert[] {
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

async function refreshAndPersist(
  userId: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string | null }> {
  const admin = supabaseAdminExtended;
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
  const admin = supabaseAdminExtended;

  await admin
    .from("device_connections")
    .update({ status: "syncing", sync_error: null })
    .eq("user_id", userId)
    .eq("provider", PROVIDER);

  try {
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
    let accessToken = tokenRow.access_token;
    let refreshToken = tokenRow.refresh_token ?? null;
    const expiresAt = tokenRow.expires_at ?? null;

    const expiresSoon =
      !!expiresAt && new Date(expiresAt).getTime() - Date.now() <= EXPIRY_SKEW_MS;
    if (expiresSoon && refreshToken) {
      const fresh = await refreshAndPersist(userId, refreshToken);
      accessToken = fresh.access_token;
      refreshToken = fresh.refresh_token;
    }

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
      startDate = connRow.synced_through;
    } else {
      const back = new Date(today);
      back.setDate(back.getDate() - DEFAULT_LOOKBACK_DAYS);
      startDate = isoDate(back);
    }

    const pullAll = (tok: string) =>
      Promise.all([
        fetchDaily(tok, "daily_sleep", startDate, endDate),
        fetchDaily(tok, "daily_readiness", startDate, endDate),
        fetchDaily(tok, "daily_activity", startDate, endDate),
      ]);

    let sleep: DailyPoint[];
    let readiness: DailyPoint[];
    let activity: DailyPoint[];
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

    const derivationInputs: SnapshotInput[] = snapshotRows.map((r) => ({
      record_date: r.record_date,
      record_type: r.record_type,
      score: r.score,
    }));
    const derived = deriveDailyScores(derivationInputs);
    const { daysWritten } = await persistDerivedScores(userId, derived);

    try {
      const { data: recent } = await admin
        .from("health_scores")
        .select("score_date, overall_score, sleep_score, activity_score")
        .eq("user_id", userId)
        .order("score_date", { ascending: false })
        .limit(2);
      const insights = generateInsights((recent ?? []) as Parameters<typeof generateInsights>[0]);
      if (insights.length > 0) {
        const rows = insights
          .map((title) => {
            const meta = SYNC_INSIGHT_CATALOG[title];
            if (!meta) return null;
            return {
              user_id: userId,
              title,
              description: meta.description,
              type: meta.type,
              severity: meta.severity,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        await admin
          .from("insights")
          .delete()
          .eq("user_id", userId)
          .gte("created_at", startOfToday.toISOString())
          .in("title", Object.keys(SYNC_INSIGHT_CATALOG));

        if (rows.length > 0) {
          const { error: insErr } = await admin.from("insights").insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
    } catch (err) {
      console.warn(`[oura-sync] insight persistence failed for ${userId}:`, (err as Error).message);
    }

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
