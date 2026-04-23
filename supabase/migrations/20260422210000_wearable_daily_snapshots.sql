-- =========================
-- wearable_daily_snapshots: normalized daily records captured from
-- provider APIs. Writes happen server-side only (supabaseAdmin). Users
-- can read their own snapshots; dashboard/reports continue reading from
-- health_scores for now. Later phases may derive health_scores from
-- these snapshots instead of computing during sync.
-- =========================

CREATE TABLE IF NOT EXISTS public.wearable_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  record_date DATE NOT NULL,
  record_type TEXT NOT NULL,
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, record_date, record_type)
);

ALTER TABLE public.wearable_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_select_own" ON public.wearable_daily_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies granted to authenticated — writes are
-- server-only via the service-role client.

CREATE INDEX IF NOT EXISTS wearable_snapshots_user_date_idx
  ON public.wearable_daily_snapshots (user_id, record_date DESC);
