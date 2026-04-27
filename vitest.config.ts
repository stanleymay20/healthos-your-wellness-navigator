// Vitest config — kept separate from vite.config.ts because that file is
// wrapped by @lovable.dev/vite-tanstack-config and adding properties to
// it can break the dev/build pipeline (per the comment in vite.config.ts).
//
// Scope: pure modules and self-contained Workers (no Supabase / no
// process.env at import time). Anything that pulls in supabaseAdmin
// stays out of this run until we add a real test harness for it.

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/lib/**/*.test.ts", "src/worker-*.test.ts"],
    environment: "node",
    globals: false,
  },
});
