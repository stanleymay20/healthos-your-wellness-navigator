
-- =========================
-- Enums
-- =========================
CREATE TYPE public.insight_type AS ENUM ('positive', 'warning', 'neutral');
CREATE TYPE public.insight_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.recommendation_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.recommendation_status AS ENUM ('pending', 'done', 'snoozed', 'dismissed');
CREATE TYPE public.recommendation_category AS ENUM ('sleep', 'activity', 'stress', 'nutrition', 'recovery', 'mindfulness');
CREATE TYPE public.device_status AS ENUM ('connected', 'disconnected', 'pending');
CREATE TYPE public.unit_system AS ENUM ('metric', 'imperial');

-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- =========================
-- user_preferences
-- =========================
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  health_goal TEXT,
  notification_preferences JSONB NOT NULL DEFAULT '{"daily_checkin": true, "weekly_report": true, "ai_recommendations": true, "milestones": false}'::jsonb,
  unit_system public.unit_system NOT NULL DEFAULT 'metric',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_select_own" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "prefs_insert_own" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_update_own" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_delete_own" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- health_logs
-- =========================
CREATE TABLE public.health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours NUMERIC(4,2),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
  water_liters NUMERIC(4,2),
  meals_note TEXT,
  exercise_minutes INTEGER CHECK (exercise_minutes >= 0),
  meditation_minutes INTEGER CHECK (meditation_minutes >= 0),
  symptoms_note TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX health_logs_user_date_idx ON public.health_logs(user_id, log_date DESC);
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select_own" ON public.health_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "logs_insert_own" ON public.health_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logs_update_own" ON public.health_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "logs_delete_own" ON public.health_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- health_scores
-- =========================
CREATE TABLE public.health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  sleep_score INTEGER CHECK (sleep_score BETWEEN 0 AND 100),
  activity_score INTEGER CHECK (activity_score BETWEEN 0 AND 100),
  stress_score INTEGER CHECK (stress_score BETWEEN 0 AND 100),
  recovery_score INTEGER CHECK (recovery_score BETWEEN 0 AND 100),
  nutrition_score INTEGER CHECK (nutrition_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, score_date)
);
CREATE INDEX health_scores_user_date_idx ON public.health_scores(user_id, score_date DESC);
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_select_own" ON public.health_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "scores_insert_own" ON public.health_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scores_update_own" ON public.health_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scores_delete_own" ON public.health_scores FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- insights
-- =========================
CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type public.insight_type NOT NULL DEFAULT 'neutral',
  severity public.insight_severity NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX insights_user_created_idx ON public.insights(user_id, created_at DESC);
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insights_select_own" ON public.insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insights_insert_own" ON public.insights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insights_update_own" ON public.insights FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insights_delete_own" ON public.insights FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- recommendations
-- =========================
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.recommendation_category NOT NULL DEFAULT 'activity',
  priority public.recommendation_priority NOT NULL DEFAULT 'medium',
  status public.recommendation_status NOT NULL DEFAULT 'pending',
  generated_for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX recommendations_user_date_idx ON public.recommendations(user_id, generated_for_date DESC);
CREATE INDEX recommendations_user_status_idx ON public.recommendations(user_id, status);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recs_select_own" ON public.recommendations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recs_insert_own" ON public.recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recs_update_own" ON public.recommendations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recs_delete_own" ON public.recommendations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- device_connections
-- =========================
CREATE TABLE public.device_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status public.device_status NOT NULL DEFAULT 'pending',
  external_user_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
ALTER TABLE public.device_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices_select_own" ON public.device_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "devices_insert_own" ON public.device_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devices_update_own" ON public.device_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "devices_delete_own" ON public.device_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================
-- updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER prefs_set_updated_at BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- handle_new_user trigger: create profile + preferences on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
