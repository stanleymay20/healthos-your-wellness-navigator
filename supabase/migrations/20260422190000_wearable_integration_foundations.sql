-- =========================
-- Wearable integration foundations (Phase 8 architecture only)
-- =========================
-- Extends device_connections with fields real provider sync will need,
-- and introduces device_oauth_tokens for server-only token storage.
-- No provider code consumes these yet.

-- Extend device_status with a 'syncing' state used while a sync job is in flight.
ALTER TYPE public.device_status ADD VALUE IF NOT EXISTS 'syncing';

-- Non-sensitive sync metadata on device_connections (client-readable via RLS).
ALTER TABLE public.device_connections
  ADD COLUMN IF NOT EXISTS scope TEXT,
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS synced_through DATE;

-- Server-only OAuth token storage. No RLS policies granted to authenticated
-- users — only the service-role client (supabaseAdmin) can read/write.
CREATE TABLE IF NOT EXISTS public.device_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.device_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no SELECT/INSERT/UPDATE/DELETE policies for the `authenticated`
-- role: this table is accessible only via the service role. Do not add client
-- policies without a threat-model review.

CREATE TRIGGER device_oauth_tokens_set_updated_at
BEFORE UPDATE ON public.device_oauth_tokens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
