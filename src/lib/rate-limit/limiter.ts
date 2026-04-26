// In-memory sliding-window rate limiter. Per-isolate state — on Cloudflare
// Workers this means the same isolate's hot path is rate-limited but a
// burst that hits multiple isolates simultaneously can slip through. That
// is acceptable for this phase (env-driven, fail-open intent) and is
// strictly better than nothing. A future phase can swap the backend for
// Cloudflare KV / Durable Objects without changing call-sites.
//
// Fail-open: if anything throws inside the limiter, the request is
// allowed. We never block legitimate traffic because the limiter itself
// is broken.

export type RateLimitResult = {
  allowed: boolean;
  // Seconds the caller should wait before retrying. Always >= 0.
  retryAfter: number;
  // For logging only.
  remaining: number;
};

// LRU-ish bound on the bucket map — we evict the oldest key when full
// to keep memory bounded under unique-key flooding.
const MAX_BUCKETS = 10_000;

// Map of key -> sorted ascending array of request timestamps (ms).
const buckets = new Map<string, number[]>();

function pruneAndEvict(now: number, windowMs: number): void {
  // Hard cap: drop the oldest 10% if we exceed MAX_BUCKETS. Insertion
  // order is preserved by Map, so the first keys are the oldest entries.
  if (buckets.size > MAX_BUCKETS) {
    const toEvict = Math.floor(MAX_BUCKETS / 10);
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= toEvict) break;
      buckets.delete(k);
    }
  }
  // Lazy prune: nothing global; per-key prune happens on each check().
  void now;
  void windowMs;
}

export function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  try {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const cutoff = now - windowMs;

    const existing = buckets.get(key) ?? [];
    // Drop timestamps outside the window.
    const fresh = existing.filter((t) => t > cutoff);

    if (fresh.length >= limit) {
      // Oldest in-window timestamp dictates when the next slot frees up.
      const retryAfterMs = fresh[0] + windowMs - now;
      // Don't update the bucket on rejection — pruning already happened.
      buckets.set(key, fresh);
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        remaining: 0,
      };
    }

    fresh.push(now);
    buckets.set(key, fresh);
    pruneAndEvict(now, windowMs);
    return {
      allowed: true,
      retryAfter: 0,
      remaining: Math.max(0, limit - fresh.length),
    };
  } catch {
    // Fail-open. Limiter outage must never block legitimate traffic.
    return { allowed: true, retryAfter: 0, remaining: limit };
  }
}

// Test-only escape hatch. Not exported to consumers in production code paths.
export function __resetForTests(): void {
  buckets.clear();
}
