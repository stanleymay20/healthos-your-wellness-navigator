// Server-only. Reads wearable_daily_snapshots from the DB and returns
// derived daily scores using the pure rule in ./derive. Does not write
// health_scores — callers decide whether to persist. A later phase can
// add a writer once we're ready to cut over from the inline sync path.

import { supabaseAdminExtended } from "@/integrations/supabase/client.extended.server";
import {
  deriveDailyScores,
  type DerivedDailyScore,
  type SnapshotInput,
} from "./derive";

type SnapshotRow = {
  record_date: string;
  record_type: string;
  score: number | null;
};

function isKnownRecordType(t: string): t is SnapshotInput["record_type"] {
  return t === "sleep" || t === "readiness" || t === "activity";
}

export async function deriveScoresFromSnapshotsForUser(args: {
  userId: string;
  startDate: string;
  endDate: string;
  provider?: string;
}): Promise<DerivedDailyScore[]> {
  const provider = args.provider ?? "oura";

  const { data, error } = await supabaseAdminExtended
    .from("wearable_daily_snapshots")
    .select("record_date, record_type, score")
    .eq("user_id", args.userId)
    .eq("provider", provider)
    .gte("record_date", args.startDate)
    .lte("record_date", args.endDate);

  if (error) throw new Error(`snapshot read failed: ${error.message}`);

  const inputs: SnapshotInput[] = ((data ?? []) as SnapshotRow[])
    .filter((r) => isKnownRecordType(r.record_type))
    .map((r) => ({
      record_date: r.record_date,
      record_type: r.record_type as SnapshotInput["record_type"],
      score: r.score,
    }));

  return deriveDailyScores(inputs);
}
