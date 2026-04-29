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
import { generateInsights } from "@/lib/insights/generate";
import {
  computeBaseline,
  computeDeviation,
  type BaselineScoreInput,
} from "@/lib/scoring/baseline";
import { logger } from "@/lib/log/logger";

const PROVIDER = "oura" as const;
const DEFAULT_LOOKBACK_DAYS = 14;
// Refresh tokens whose access_token expires within this window, so we avoid
// burning a request on a near-dead token.
const EXPIRY_SKEW_MS = 60_000;
// How many recent score rows we read for baseline + insight context.
// Latest is the day we're evaluating; the rest form the baseline window.
const INSIGHT_CONTEXT_DAYS = 15;

// Canonical sync-generated insights. Some titles are exact strings; some
// are stems matched by prefix (the generator emits dynamic σ values for
// baseline-aware insights, so we can't enumerate every full title). Each
// entry's `match` is either a literal full title or a prefix.
type InsightTone = "positive" | "warning" | "neutral";
type InsightLevel = "low" | "medium" | "high";
type CatalogEntry = {
  match: string;
  matchType: "exact" | "prefix";
  description: string;
  type: InsightTone;
  severity: InsightLevel;
};
const SYNC_INSIGHT_CATALOG: CatalogEntry[] = [
  // Baseline-aware (prefix matches; titles include dynamic σ values).
  {
    match: "Sleep is",
    matchType: "prefix",
    description: "Tonight's sleep score is well below your usual range. Protect your wind-down window.",
    type: "warning",
    severity: "high",
  },
  {
    match: "Recovery is",
    matchType: "prefix",
    description: "Your recovery signal has dropped relative to your recent baseline. A lighter day and earlier sleep can reset it.",
    type: "warning",
    severity: "high",
  },
  {
    match: "Activity is",
    matchType: "prefix",
    description: "Your activity has dropped relative to your recent baseline. Even short, gentle movement helps.",
    type: "warning",
    severity: "medium",
  },
  {
    match: "You're well above your recent baseline",
    matchType: "prefix",
    description: "Your overall score is meaningfully above your recent baseline. Keep the current routine and momentum compounds.",
    type: "positive",
    severity: "low",
  },
  // Fixed-threshold fallbacks (exact matches, identical to pre-baseline behavior).
  {
    match: "Your recovery is low. Prioritize rest today.",
    matchType: "exact",
    description: "Latest overall score is below 50. Consider a lighter day and earlier wind-down.",
    type: "warning",
    severity: "high",
  },
  {
    match: "Your sleep quality dropped. Consider earlier sleep.",
    matchType: "exact",
    description: "Sleep score fell below 60. Protecting an earlier wind-down tonight can rebuild the baseline.",
    type: "warning",
    severity: "medium",
  },
  {
    match: "Low activity detected. Try light movement today.",
    matchType: "exact",
    description: "Activity score is below 50. A short walk or mobility session can lift today's signal.",
    type: "warning",
    severity: "medium",
  },
  {
    match: "You're improving. Keep your routine consistent.",
    matchType: "exact",
    description: "Overall score improved versus the previous day. Consistency is compounding.",
    type: "positive",
    severity: "low",
  },
];

function lookupCatalog(title: string): CatalogEntry | null {
  // Prefer exact matches; otherwise pick the longest matching prefix.
  const exact = SYNC_INSIGHT_CATALOG.find(
    (c) => c.matchType === "exact" && c.match === title,
  );
  if (exact) return exact;
  const prefixes = SYNC_INSIGHT_CATALOG.filter(
    (c) => c.matchType === "prefix" && title.startsWith(c.match),
  ).sort((a, b) => b.match.length - a.match.length);
  return prefixes[0] ?? null;
}

// Thrown only when the upstream signal clearly indicates the stored token
// is no longer usable (revoked, expired beyond refresh, scope stripped,
// user deleted on the provider side). Any other failure is considered
// transient and must not flip the connection to disconnected.
export class TokenRevokedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRevokedError";
  }
}

// Thrown when a per-user sync is already in flight (lock held by another
// caller). Distinct from a token problem — the caller should treat it as
// "skipped, try again later," not as a failure.
export class SyncLockHeldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncLockHeldError";
  }
}

// How long we hold the lock before another caller is allowed to reclaim
// it. Real syncs complete in seconds (3 API calls + DB writes). Ten
// minutes is generous enough that a slow run won't get reclaimed mid-
// flight, but short enough that a crashed sync doesn't keep the user
// locked out for long.
const SYNC_LOCK_TTL_MS = 10 * 60 * 1000;

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
//
// Exported so the proactive token-refresh sidecar (Phase 35) can reuse the
// same persistence + invalid-refresh handling without duplicating the logic.
export async function refreshAndPersist(
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

// Atomic per-(user, provider) lock acquire. Single conditional UPDATE: if
// the existing locked_until is NULL or already in the past, claim it; if
// another caller holds an unexpired lock, the WHERE matches no rows and
// the RETURNING is empty. Returns:
//   "acquired" — we now hold the lock; caller must release in a finally
//   "held"     — another sync is in flight; caller should bail
//   "no_row"   — no device_connections row exists for this user/provider;
//                fall through (the existing token check will surface the
//                "no connection" condition with the right error)
export async function tryAcquireSyncLock(
  admin: { from: (t: string) => any },
  userId: string,
): Promise<"acquired" | "held" | "no_row"> {
  const nowIso = new Date().toISOString();
  const lockUntilIso = new Date(Date.now() + SYNC_LOCK_TTL_MS).toISOString();

  const { data: updated, error: updErr } = await admin
    .from("device_connections")
    .update({ locked_until: lockUntilIso })
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select("id")
    .maybeSingle();
  if (updErr) throw new Error(`sync lock acquire failed: ${updErr.message}`);
  if (updated) return "acquired";

  // Zero rows updated. Disambiguate "locked" from "no row" with a SELECT
  // — the difference matters because the existing flow handles "no row"
  // with TokenRevokedError, but "held" should bail as a skip.
  const { data: existing } = await admin
    .from("device_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  return existing ? "held" : "no_row";
}

export async function releaseSyncLock(
  admin: { from: (t: string) => any },
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from("device_connections")
    .update({ locked_until: null })
    .eq("user_id", userId)
    .eq("provider", PROVIDER);
  if (error) {
    // Non-fatal: the TTL will reclaim the lock eventually. Just log so we
    // can spot persistent release failures in operations.
    logger.warn({
      event: "oura_sync.lock_release_failed",
      userId,
      provider: PROVIDER,
      error: error.message,
    });
  }
}

export async function syncOuraForUser(userId: string): Promise<SyncOutcome> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };

  // 0. Acquire the per-user sync lock. If another caller already holds it,
  //    bail with SyncLockHeldError so the batch can count this as a skip
  //    (not a failure) and move on.
  const lockState = await tryAcquireSyncLock(admin, userId);
  if (lockState === "held") {
    logger.info({
      event: "oura_sync.lock_held_skipping",
      userId,
      provider: PROVIDER,
    });
    throw new SyncLockHeldError(
      "Another sync is already in flight for this user.",
    );
  }

  try {
    return await runSyncOuraForUser(userId, admin);
  } finally {
    await releaseSyncLock(admin, userId);
  }
}

// The actual sync body, run only after the per-user lock has been acquired.
// Split out from syncOuraForUser purely so the lock acquire/release can wrap
// it without re-indenting every line.
async function runSyncOuraForUser(
  userId: string,
  admin: { from: (t: string) => any },
): Promise<SyncOutcome> {
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
      payload: (r.payload as Record<string, unknown> | null) ?? null,
    }));
    const derived = deriveDailyScores(derivationInputs);
    const { daysWritten } = await persistDerivedScores(userId, derived);

    // 5b. Generate post-sync insights with adaptive-baseline context, then
    //     persist them under public.insights. Idempotent across repeated
    //     syncs on the same day: delete today's sync-generated rows
    //     (matched against the catalog so we don't clobber insights from
    //     the manual-log engine flow), then insert the fresh batch.
    //     Failures are non-fatal — insights are advisory.
    try {
      const { data: recent } = await admin
        .from("health_scores")
        .select("score_date, overall_score, sleep_score, recovery_score, activity_score")
        .eq("user_id", userId)
        .order("score_date", { ascending: false })
        .limit(INSIGHT_CONTEXT_DAYS);
      const recentRows = (recent ?? []) as BaselineScoreInput[];

      const baseline = computeBaseline(recentRows);
      const deviation =
        baseline && recentRows.length > 0
          ? computeDeviation(recentRows[0], baseline)
          : null;

      const insightInputs = recentRows.map((r) => ({
        score_date: r.score_date,
        overall_score: r.overall_score,
        sleep_score: r.sleep_score,
        activity_score: r.activity_score,
      }));
      const insights = generateInsights(insightInputs, { baseline, deviation });

      if (insights.length > 0) {
        const rows = insights
          .map((title) => {
            const meta = lookupCatalog(title);
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

        // Two-query delete: pull today's existing rows, filter to ones whose
        // titles match the catalog, then delete by id. More robust than a
        // PostgREST .or() filter when titles contain dots / apostrophes /
        // dynamic values.
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const { data: existing } = await admin
          .from("insights")
          .select("id, title")
          .eq("user_id", userId)
          .gte("created_at", startOfToday.toISOString());

        const ids = ((existing ?? []) as Array<{ id: string; title: string }>)
          .filter((r) => lookupCatalog(r.title) !== null)
          .map((r) => r.id);
        if (ids.length > 0) {
          await admin.from("insights").delete().in("id", ids);
        }

        if (rows.length > 0) {
          const { error: insErr } = await admin.from("insights").insert(rows);
          if (insErr) throw new Error(insErr.message);
        }
      }
    } catch (err) {
      // Non-fatal — insights are advisory.
      logger.warn({
        event: "oura_sync.insights.persist_failed",
        userId,
        provider: PROVIDER,
        error: (err as Error).message,
      });
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

    return { daysWritten, syncedThrough: endDate };
  } catch (e) {
    // 7. Only flip to disconnected when the token itself is the problem
    //    (401/403 from Oura, or the row is gone). Everything else — network
    //    hiccups, 5xx, 429 rate limits, DB errors — is transient: keep the
    //    connection logically connected, record the error, and leave
    //    last_synced_at untouched so the user can see "last success" state.
    const message = (e as Error).message.slice(0, 500);
    const tokenProblem = e instanceof TokenRevokedError;
    logger.error({
      event: "oura_sync.failed",
      userId,
      provider: PROVIDER,
      tokenProblem,
      error: message,
    });
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
