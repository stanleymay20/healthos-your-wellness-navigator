// Server-side error tracker. Speaks Sentry's raw envelope protocol via
// `fetch`, so no SDK dependency is needed — the whole file is ~120 lines
// and adds zero to `package.json`. Enough for enterprise-grade error
// capture; can be swapped for the official SDK later if we want session
// tracking, performance, or breadcrumbs (the callsite API stays the same).
//
// Gated on SENTRY_DSN. No-op when the env var is absent, so the sentry
// path is off by default and never crashes callers. Callers should still
// call the structured `logger.error(...)` for the log drain — this
// module is an additional sink, not a replacement.
//
// See docs/runbooks/error-tracking.md for how to configure.

const SENTRY_DSN = process.env.SENTRY_DSN ?? "";
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? "production";
const SENTRY_RELEASE = process.env.SENTRY_RELEASE;

const CLIENT_UA = "healthos-server/1.0";
const MAX_MESSAGE_LEN = 500;
const MAX_STACK_LEN = 4000;

export type ErrorContext = {
  route?: string;
  userId?: string;
  event?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

type ParsedDsn = {
  publicKey: string;
  host: string;
  projectId: string;
  rawDsn: string;
};

// DSN format: https://<publicKey>@<host>/<projectId>. Exported so tests
// can exercise it without going through the full capture path.
export function parseDsn(dsn: string): ParsedDsn | null {
  if (!dsn) return null;
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const publicKey = url.username;
  const projectId = url.pathname.replace(/^\/+/, "");
  if (!publicKey || !url.host || !projectId) return null;
  return { publicKey, host: url.host, projectId, rawDsn: dsn };
}

const parsed = parseDsn(SENTRY_DSN);

// Build the JSON event body Sentry expects inside an envelope. Exported
// so the envelope format can be asserted in tests without a fetch mock.
export function buildEvent(
  err: unknown,
  context: ErrorContext,
  eventId: string,
  timestamp: string,
): Record<string, unknown> {
  const error = err instanceof Error ? err : new Error(String(err));
  return {
    event_id: eventId,
    timestamp,
    platform: "node",
    level: "error",
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    server_name: "healthos-server",
    logger: context.event ?? "captureException",
    tags: {
      ...(context.tags ?? {}),
      ...(context.route ? { route: context.route } : {}),
    },
    user: context.userId ? { id: context.userId } : undefined,
    exception: {
      values: [
        {
          type: error.name || "Error",
          value: (error.message || String(err)).slice(0, MAX_MESSAGE_LEN),
          stacktrace: parseStack(error.stack),
        },
      ],
    },
    extra: context.extra,
  };
}

type Frame = { function?: string; filename?: string; lineno?: number; colno?: number };

function parseStack(stack: string | undefined): { frames: Frame[] } | undefined {
  if (!stack) return undefined;
  const truncated = stack.slice(0, MAX_STACK_LEN);
  // Standard V8/JS stack: "at fn (file:line:col)" or "at file:line:col".
  // We build Sentry's oldest-first frames array by reversing.
  const frames: Frame[] = [];
  const re = /at (?:(.+?) \()?([^\s()]+):(\d+):(\d+)\)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(truncated)) !== null) {
    frames.push({
      function: m[1] || undefined,
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
    });
  }
  if (frames.length === 0) return undefined;
  return { frames: frames.reverse() };
}

function randomEventId(): string {
  // Sentry expects a 32-char hex event_id. crypto.randomUUID is available
  // in the Workers runtime and modern Node; strip dashes to hit 32 chars.
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

export function isConfigured(): boolean {
  return parsed !== null;
}

// Fire-and-forget error capture. Never throws — a failed capture must
// not disrupt the calling code path. Returns void; callers can `await`
// if they need to ensure the request completed before the Worker exits.
export async function captureException(
  err: unknown,
  context: ErrorContext = {},
): Promise<void> {
  if (!parsed) return;
  const eventId = randomEventId();
  const timestamp = new Date().toISOString();
  const event = buildEvent(err, context, eventId, timestamp);
  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: timestamp, dsn: parsed.rawDsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    await fetch(`https://${parsed.host}/api/${parsed.projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7,sentry_key=${parsed.publicKey},sentry_client=${CLIENT_UA}`,
      },
      body: envelope,
    });
  } catch {
    // Intentional swallow — see file header. If Sentry ingest is down we
    // still have the structured log line.
  }
}
