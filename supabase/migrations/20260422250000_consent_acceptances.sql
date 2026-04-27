-- =========================
-- consent_acceptances: immutable record of which version of which legal
-- document a user accepted, and when. Required for GDPR/CCPA defensibility
-- ("the user accepted version X of the privacy policy at time Y").
-- =========================

DO $$ BEGIN
  CREATE TYPE public.consent_doc AS ENUM ('tos', 'privacy');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.consent_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document public.consent_doc NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  UNIQUE (user_id, document, version)
);

ALTER TABLE public.consent_acceptances ENABLE ROW LEVEL SECURITY;

-- Users see their own acceptances (Settings + onboarding hydrate from this).
CREATE POLICY "consent_select_own" ON public.consent_acceptances
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can record their own acceptance from the client. The UNIQUE
-- constraint + ON CONFLICT DO NOTHING in callers makes this idempotent.
-- Intentionally no UPDATE/DELETE policies — acceptances are immutable.
CREATE POLICY "consent_insert_own" ON public.consent_acceptances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS consent_acceptances_user_doc_idx
  ON public.consent_acceptances (user_id, document, accepted_at DESC);
