# HealthOS

Preventive-wellness application and healthcare-domain engineering portfolio built with React 19, TanStack Start, Supabase, Tailwind v4, and Cloudflare-oriented deployment tooling.

## What this repository demonstrates

HealthOS focuses on the application and data foundations needed for personalized wellness software:

- authenticated onboarding and user profiles;
- health logs and longitudinal wellness data;
- health-score and insight surfaces;
- recommendations and user preferences;
- device-connection records;
- row-level security scoped to the authenticated user;
- typed frontend/service layers and production build tooling.

The repository is useful as healthcare-domain engineering evidence, but it should not be interpreted as a clinically validated diagnostic system or certified medical device.

## Architecture

```text
Authenticated user
      ↓
TanStack Start application
      ↓
Health / scoring / recommendation services
      ↓
Supabase Auth + Postgres
      ↓
Row-Level Security (auth.uid())
```

Project layout:

```text
src/
  routes/          TanStack file-based routes (_app/* = protected)
  components/      UI (brand, dashboard, landing, ui)
  contexts/        AuthContext (Supabase session)
  integrations/    Supabase client + generated types
  services/        health, scoring, engine
  lib/             onboarding and shared helpers
supabase/
  migrations/      SQL schema + RLS policies
```

## Auth and onboarding

Signed-in users land on `/dashboard`. New users are redirected to `/onboarding` until `profiles.full_name` and `user_preferences.health_goal` are both set. The completeness check is centralized in `src/lib/onboarding.ts`.

## Data access

Key tables include `profiles`, `user_preferences`, `health_logs`, `health_scores`, `insights`, `recommendations`, and `device_connections`. User-facing records are protected with row-level security scoped to `auth.uid()`.

## Quick start

```bash
bun install
cp .env.example .env
bun run dev
```

Useful checks:

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

The GitHub Actions quality gate runs these checks automatically and also rejects tracked non-template environment files.

## Security and healthcare boundaries

See `SECURITY.md`. Any deployment handling real health information requires a separate privacy, security, retention, and regulatory assessment for the jurisdiction and intended use. This repository does not claim clinical validation or production healthcare certification.
