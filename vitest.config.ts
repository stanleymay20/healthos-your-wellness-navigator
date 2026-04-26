// Vitest config — kept separate from vite.config.ts because that file is
// wrapped by @lovable.dev/vite-tanstack-config and adding properties to
// it can break the dev/build pipeline (per the comment in vite.config.ts).
//
// Scope is intentionally narrow: pure modules under src/lib only. The
// server-only modules that pull in supabaseAdmin / process.env stay out
// of this run until we add a real test harness for them.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/lib/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
