-- =========================
-- Per-user sync concurrency lock (Phase 34)
-- =========================
-- Today nothing prevents two syncOuraForUser invocations for the same user
-- from racing — e.g. the cron firing while a manual "Sync now" is in flight.
-- They'd burn double API quota and clobber each other's last_synced_at /
-- synced_through cursors. Postgres unique constraints save us from data
-- corruption on the snapshot/score upserts, but we still want the second
-- caller to bail out cleanly.
--
-- Adds a TTL'd advisory lock column on device_connections that callers
-- acquire via a single conditional UPDATE (atomic per (user_id, provider)
-- thanks to the existing UNIQUE constraint). If the lock is held and not
-- expired, the UPDATE matches no rows and the second caller skips. The TTL
-- handles crashed syncs that never released — after locked_until passes,
-- the lock is reclaimable.
--
-- Also adds users_skipped to sync_runs for operational visibility into
-- lock contention from the scheduled batch.

ALTER TABLE public.device_connections
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Partial index: only rows with an active lock are candidates for the
-- "is this still locked?" check, which is the only query that needs index
-- support. NULL locked_until rows are the common case and don't need it.
CREATE INDEX IF NOT EXISTS device_connections_locked_until_idx
  ON public.device_connections (provider, locked_until)
  WHERE locked_until IS NOT NULL;

ALTER TABLE public.sync_runs
  ADD COLUMN IF NOT EXISTS users_skipped INTEGER NOT NULL DEFAULT 0;
