// Server-only. Iterates connected Oura users and runs syncOuraForUser
// for each, isolating failures so one bad user doesn't halt the batch.
// Writes a single sync_runs row for operational visibility. Invoked by
// /api/admin/oura-sync-cron; not user-facing.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncOuraForUser } from "./oura-sync.server";

const PROVIDER = "oura" as const;
const MAX_FIRST_ERROR_LEN = 500;
const MAX_FAILURE_SAMPLES = 20;

export type BatchFailure = { userId: string; error: string };

export type BatchOutcome = {
  usersScanned: number;
  usersSynced: number;
  usersFailed: number;
  failures: BatchFailure[];
  runId: string | null;
};

export async function runScheduledOuraSync(): Promise<BatchOutcome> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };
  const startedAt = new Date().toISOString();

  // Pick users whose Oura connection is logically live. Skip 'disconnected'
  // — they need the user to reconnect via OAuth before sync can succeed.
  // 'syncing' is treated as a stale flag (a prior run crashed mid-flight);
  // it's safe to re-enter because syncOuraForUser re-flips it.
  const { data: connections, error: connErr } = await admin
    .from("device_connections")
    .select("user_id, status")
    .eq("provider", PROVIDER)
    .in("status", ["connected", "syncing"]);

  if (connErr) {
    // Couldn't even read the candidate set — record the run as a failure
    // with zero users and surface.
    const { data: runRow } = await admin
      .from("sync_runs")
      .insert({
        provider: PROVIDER,
        users_scanned: 0,
        users_synced: 0,
        users_failed: 0,
        first_error: `candidate lookup failed: ${connErr.message}`.slice(0, MAX_FIRST_ERROR_LEN),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    throw new Error(`candidate lookup failed: ${connErr.message}${runRow?.id ? ` (run ${runRow.id})` : ""}`);
  }

  const candidates = (connections ?? []) as Array<{ user_id: string }>;
  const usersScanned = candidates.length;
  let usersSynced = 0;
  let usersFailed = 0;
  const failures: BatchFailure[] = [];
  let firstError: string | null = null;

  for (const row of candidates) {
    try {
      await syncOuraForUser(row.user_id);
      usersSynced++;
    } catch (err) {
      usersFailed++;
      const message = (err as Error).message.slice(0, MAX_FIRST_ERROR_LEN);
      if (!firstError) firstError = message;
      if (failures.length < MAX_FAILURE_SAMPLES) {
        failures.push({ userId: row.user_id, error: message });
      }
    }
  }

  const finishedAt = new Date().toISOString();
  let runId: string | null = null;
  const { data: runRow, error: runErr } = await admin
    .from("sync_runs")
    .insert({
      provider: PROVIDER,
      users_scanned: usersScanned,
      users_synced: usersSynced,
      users_failed: usersFailed,
      first_error: firstError,
      started_at: startedAt,
      finished_at: finishedAt,
    })
    .select("id")
    .maybeSingle();
  if (!runErr && runRow?.id) runId = runRow.id as string;

  return { usersScanned, usersSynced, usersFailed, failures, runId };
}
