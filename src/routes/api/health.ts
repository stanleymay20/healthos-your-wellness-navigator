// Liveness probe. Intentionally unauthenticated and side-effect-free —
// no DB call, no external fetch — so it can't false-fail and so it's
// cheap enough to hammer from uptime monitors.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            ts: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
