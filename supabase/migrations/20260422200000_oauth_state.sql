-- =========================
-- oauth_state: single-use handshake records bridging the auth redirect
-- and the callback. Accessed only via the service role; authenticated
-- users have no policies granted.
-- =========================

CREATE TABLE IF NOT EXISTS public.oauth_state (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  code_verifier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;
-- No policies granted for `authenticated` — server-only table.

CREATE INDEX IF NOT EXISTS oauth_state_expires_at_idx
  ON public.oauth_state (expires_at);
