-- =========================
-- subscriptions: mirror of the user's Stripe subscription state.
-- =========================
-- One row per user. Hydrated by the Stripe webhook handler
-- (/api/billing/webhook) — never written by the client. The service-role
-- client is the only writer; users read their own row for plan display.
--
-- Rows exist only after the user's first successful checkout. Absent row
-- = free tier. This matches the pricing surface: "Start Free" costs
-- nothing to model as an empty row.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  -- Canonical local plan identifier ("pro", "family"). Decoupled from the
  -- Stripe price id so we can rotate prices without renaming plans.
  plan_slug TEXT,
  -- Stripe subscription status. NULL between checkout.session.completed
  -- and the first customer.subscription.created event.
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook lookups arrive by stripe_customer_id (that's what Stripe
-- includes on every event). Index it so the upsert is O(log n), not
-- O(n) on the users table.
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users read their own row for plan display in the UI. Every write goes
-- through the service-role client (webhook handler + checkout success
-- callback), so no INSERT/UPDATE/DELETE policies are granted to
-- `authenticated`.
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
