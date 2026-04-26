// Liveness probe. Intentionally unauthenticated and side-effect-free —
// no DB call, no external fetch — so it can't false-fail and so it's
// cheap enough to hammer from uptime monitors.

import { createFileRoute } from "@tanstack/react-router";
import { secureJsonResponse } from "@/lib/api/response";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return secureJsonResponse({ ok: true, ts: new Date().toISOString() });
      },
    },
  },
});
