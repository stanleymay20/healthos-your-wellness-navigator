-- =========================
-- account_deletions: queue for GDPR Article 17 / right-to-be-forgotten
-- requests. The user's data is preserved for a 30-day grace window so
-- accidental clicks (or stolen sessions) can be reversed before any
-- destructive action runs. Hard delete is performed by a separate
-- worker (future phase), not by this endpoint.
-- =========================

CREATE TABLE IF NOT EXISTS public.account_deletions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  requester_ip TEXT,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Users can read their own pending row so the Settings UI can show the
-- scheduled date. Writes are server-only via supabaseAdmin — there are
-- no INSERT/UPDATE/DELETE policies for `authenticated`.
CREATE POLICY "deletions_select_own" ON public.account_deletions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Index for the future hard-delete worker: the cron will sweep rows
-- whose scheduled_for has passed and which are neither cancelled nor
-- already executed.
CREATE INDEX IF NOT EXISTS account_deletions_due_idx
  ON public.account_deletions (scheduled_for)
  WHERE cancelled_at IS NULL AND executed_at IS NULL;
