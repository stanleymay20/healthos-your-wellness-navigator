# HealthOS

AI-powered preventive health platform. React 19 + TanStack Start, Supabase, Tailwind v4, deployed on Cloudflare.

## Quick start

```bash
npm install
cp .env.example .env          # fill in your Supabase values
npm run dev                   # http://localhost:5173
```

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start Vite dev server                     |
| `npm run build`     | Production build (also regenerates the TanStack route tree) |
| `npm run build:dev` | Development-mode build                    |
| `npm run preview`   | Serve the production build locally        |
| `npm run lint`      | ESLint                                    |
| `npm run format`    | Prettier (writes)                         |
| `npx tsc --noEmit`  | Typecheck only                            |

## Environment variables

See `.env.example`. All Supabase values are public (anon key + project URL) — row-level security protects user data. Never commit a real `.env`.

## Project layout

```
src/
  routes/          TanStack file-based routes (_app/* = protected)
  components/      UI (brand, dashboard, landing, ui)
  contexts/        AuthContext (Supabase session)
  integrations/    supabase client + generated types
  services/        health, scoring, engine
  lib/             small helpers (onboarding status, utils)
supabase/
  migrations/      SQL schema + RLS policies
```

## Auth & onboarding

Signed-in users land on `/dashboard`. New users are redirected to `/onboarding` until `profiles.full_name` and `user_preferences.health_goal` are both set. The completeness check is centralized in `src/lib/onboarding.ts`.

## Database

Schema is defined in `supabase/migrations/`. Key tables: `profiles`, `user_preferences`, `health_logs`, `health_scores`, `insights`, `recommendations`, `device_connections`. All have row-level security scoped to `auth.uid()`.
