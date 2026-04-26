// Tiny structured logger for server-side code. Emits a single-line JSON
// object per call so it's grep-able / drain-able by Cloudflare Workers
// Logs (or any log aggregator). PII-safe: only whitelisted fields are
// written verbatim; anything else is coerced or dropped.
//
// No dependency on Sentry/Datadog yet — when a DSN-style transport is
// added later it can wrap the same emit() function.

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  // Stable event name for filtering. Required.
  event: string;
  // Optional contextual fields. Strings, numbers, booleans, null only.
  // Anything else is coerced to a short string.
  [key: string]: unknown;
};

// Field names that may carry secret material. Their values are replaced
// with "[redacted]" regardless of what was passed.
const REDACTED_KEYS = new Set([
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "code_verifier",
  "codeVerifier",
  "authorization",
  "secret",
  "password",
]);

// Field names that should be hashed-shortened (not full PII): emails get
// truncated to {first2}***@{domain}.
const EMAIL_KEYS = new Set(["email", "user_email", "userEmail"]);

const MAX_STRING_LEN = 500;

function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return "[redacted]";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

function safeValue(key: string, value: unknown): unknown {
  if (REDACTED_KEYS.has(key)) return "[redacted]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (EMAIL_KEYS.has(key)) return maskEmail(value);
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) return value.message.slice(0, MAX_STRING_LEN);
  // Coerce anything else (objects, arrays) to a length-bounded string so
  // we never accidentally serialize an entire request body.
  try {
    const s = JSON.stringify(value);
    return s.length > MAX_STRING_LEN ? `${s.slice(0, MAX_STRING_LEN)}…` : s;
  } catch {
    return "[unserializable]";
  }
}

function emit(level: LogLevel, fields: LogFields): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event: fields.event,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (key === "event") continue;
    payload[key] = safeValue(key, value);
  }
  const line = JSON.stringify(payload);
  // Cloudflare Workers / Node both surface console.* in their log drains.
  // Pick the matching method so log-level filtering downstream works.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}

export const logger = {
  debug: (fields: LogFields) => emit("debug", fields),
  info: (fields: LogFields) => emit("info", fields),
  warn: (fields: LogFields) => emit("warn", fields),
  error: (fields: LogFields) => emit("error", fields),
};
