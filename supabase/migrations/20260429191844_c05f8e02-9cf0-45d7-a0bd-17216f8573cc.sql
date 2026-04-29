CREATE TABLE IF NOT EXISTS public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  user_id uuid NULL,
  route text NULL,
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON public.app_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_errors_request_id ON public.app_errors (request_id);
CREATE INDEX IF NOT EXISTS idx_app_errors_user_id ON public.app_errors (user_id) WHERE user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'app_errors'
      AND policyname = 'No direct user access to app errors'
  ) THEN
    CREATE POLICY "No direct user access to app errors"
    ON public.app_errors
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;