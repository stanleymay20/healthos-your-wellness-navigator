-- =========================
-- sync_runs: lightweight visibility into scheduled sync runs. Writes
-- happen server-side only (supabaseAdmin from the sync cron route).
-- No policies for authenticated — operational data only.
-- =========================

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  users_scanned INTEGER NOT NULL DEFAULT 0,
  users_synced INTEGER NOT NULL DEFAULT 0,
  users_failed INTEGER NOT NULL DEFAULT 0,
  first_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
-- No INSERT/SELECT/UPDATE/DELETE policies for authenticated — server-only.

CREATE INDEX IF NOT EXISTS sync_runs_provider_started_idx
  ON public.sync_runs (provider, started_at DESC);
