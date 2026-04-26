-- =========================
-- admin_audit_log: every admin/operator-route invocation, recorded for
-- forensics and compliance. Server-only — written via supabaseAdmin
-- after each admin request resolves. Authenticated users have no
-- policies; this is operational data only.
-- =========================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT NOT NULL,
  caller_ip TEXT,
  caller_user_id UUID,
  payload_digest TEXT,
  outcome TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for the `authenticated` role: the service
-- role is the only writer/reader.

CREATE INDEX IF NOT EXISTS admin_audit_log_route_created_idx
  ON public.admin_audit_log (route, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_outcome_created_idx
  ON public.admin_audit_log (outcome, created_at DESC);
