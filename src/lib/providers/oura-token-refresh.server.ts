// Server-only. Proactively refreshes Oura access tokens before they expire,
// so a sleep-time sync doesn't burn its first request on a stale token.
//
// Mirrors runScheduledOuraSync's per-user iteration: pulls candidates whose
// token is within the refresh-ahead window, takes the same per-user sync
// lock to avoid racing with an in-flight sync (Oura rotates refresh tokens,
// so two concurrent refreshes would invalidate each other), then delegates
// to refreshAndPersist — the exact same writer the sync path uses on
// pre-flight refresh, so persistence shape and invalid-refresh handling
// stay consistent.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  refreshAndPersist,
  releaseSyncLock,
  SyncLockHeldError,
  TokenRevokedError,
  tryAcquireSyncLock,
} from "./oura-sync.server";

const PROVIDER = "oura" as const;
const MAX_FIRST_ERROR_LEN = 500;
const MAX_FAILURE_SAMPLES = 20;
// Refresh tokens whose access_token expires within this window. Sized so a
// 4-hour cron always has at least one full interval of margin: even if a
// run misses, the next run still catches the token before it dies.
const DEFAULT_REFRESH_AHEAD_MS = 6 * 60 * 60 * 1000;

export type TokenRefreshFailure = { userId: string; error: string };

export type TokenRefreshOutcome = {
  candidates: number;
  refreshed: number;
  invalidated: number;
  skipped: number;
  failed: number;
  failures: TokenRefreshFailure[];
};

export async function runScheduledTokenRefresh(
  refreshAheadMs: number = DEFAULT_REFRESH_AHEAD_MS,
): Promise<TokenRefreshOutcome> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };
  const cutoffIso = new Date(Date.now() + refreshAheadMs).toISOString();

  // Candidate set: tokens that (a) belong to our provider, (b) have a
  // refresh_token (no point if we can't refresh), and (c) expire before
  // the cutoff. Tokens with NULL expires_at are skipped — we don't know
  // when they die, so leave them to the sync-time pre-flight refresh.
  const { data: tokens, error } = await admin
    .from("device_oauth_tokens")
    .select("user_id, refresh_token, expires_at")
    .eq("provider", PROVIDER)
    .lt("expires_at", cutoffIso)
    .not("refresh_token", "is", null);
  if (error) {
    throw new Error(`token candidate lookup failed: ${error.message}`);
  }

  const candidates = (tokens ?? []) as Array<{
    user_id: string;
    refresh_token: string;
    expires_at: string | null;
  }>;

  // Cross-check: only refresh users whose connection is still logically
  // live. Don't burn refresh attempts on tokens whose connection has
  // already been marked disconnected — those need a user-driven reconnect.
  let liveUsers = new Set<string>();
  if (candidates.length > 0) {
    const { data: conns } = await admin
      .from("device_connections")
      .select("user_id, status")
      .eq("provider", PROVIDER)
      .in(
        "user_id",
        candidates.map((c) => c.user_id),
      );
    liveUsers = new Set(
      ((conns ?? []) as Array<{ user_id: string; status: string }>)
        .filter((c) => c.status === "connected" || c.status === "syncing")
        .map((c) => c.user_id),
    );
  }

  let refreshed = 0;
  let invalidated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: TokenRefreshFailure[] = [];

  for (const t of candidates) {
    if (!liveUsers.has(t.user_id)) {
      skipped++;
      continue;
    }
    // Take the same per-user sync lock the sync path uses. If a sync is
    // mid-flight it'll already have refreshed (or will), and we shouldn't
    // race on Oura's rotated refresh_token.
    let lockState: "acquired" | "held" | "no_row";
    try {
      lockState = await tryAcquireSyncLock(admin, t.user_id);
    } catch (err) {
      failed++;
      pushFailure(failures, t.user_id, (err as Error).message);
      continue;
    }
    if (lockState === "held") {
      skipped++;
      continue;
    }
    // "no_row" can't happen here in practice — we only got `t.user_id` from
    // a join with device_connections — but treat it the same as "acquired"
    // for symmetry; release will be a no-op on a missing row.
    try {
      await refreshAndPersist(t.user_id, t.refresh_token);
      refreshed++;
    } catch (err) {
      if (err instanceof TokenRevokedError) {
        invalidated++;
        // refreshAndPersist already deleted the token row. Mark the
        // connection disconnected so the UI can prompt a reconnect.
        await admin
          .from("device_connections")
          .update({
            status: "disconnected",
            sync_error: "Refresh token invalid; reconnect required.",
          })
          .eq("user_id", t.user_id)
          .eq("provider", PROVIDER);
      } else if (err instanceof SyncLockHeldError) {
        // Defensive — tryAcquireSyncLock returned "acquired" so we
        // shouldn't see this, but if we ever route through other code
        // that throws it, count consistently.
        skipped++;
      } else {
        failed++;
        pushFailure(failures, t.user_id, (err as Error).message);
      }
    } finally {
      await releaseSyncLock(admin, t.user_id);
    }
  }

  return {
    candidates: candidates.length,
    refreshed,
    invalidated,
    skipped,
    failed,
    failures,
  };
}

function pushFailure(
  failures: TokenRefreshFailure[],
  userId: string,
  message: string,
): void {
  if (failures.length < MAX_FAILURE_SAMPLES) {
    failures.push({ userId, error: message.slice(0, MAX_FIRST_ERROR_LEN) });
  }
}
