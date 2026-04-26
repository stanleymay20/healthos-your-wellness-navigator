import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetForTests, enforceRateLimit } from "./limiter";

afterEach(() => {
  __resetForTests();
  vi.useRealTimers();
});

describe("enforceRateLimit", () => {
  it("allows requests up to the limit then rejects", () => {
    const r1 = enforceRateLimit("k", 3, 60);
    const r2 = enforceRateLimit("k", 3, 60);
    const r3 = enforceRateLimit("k", 3, 60);
    const r4 = enforceRateLimit("k", 3, 60);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);
  });

  it("releases capacity after the window passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    enforceRateLimit("k", 2, 60);
    enforceRateLimit("k", 2, 60);
    expect(enforceRateLimit("k", 2, 60).allowed).toBe(false);

    // Advance past the 60s window.
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(enforceRateLimit("k", 2, 60).allowed).toBe(true);
  });

  it("computes retryAfter from the oldest in-window timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    enforceRateLimit("k", 1, 60);

    // 10 seconds later, bucket is still full → retry should be ~50s.
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    const r = enforceRateLimit("k", 1, 60);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThanOrEqual(49);
    expect(r.retryAfter).toBeLessThanOrEqual(51);
  });

  it("isolates buckets per key", () => {
    enforceRateLimit("a", 1, 60);
    expect(enforceRateLimit("a", 1, 60).allowed).toBe(false);
    expect(enforceRateLimit("b", 1, 60).allowed).toBe(true);
  });

  it("reports remaining on success", () => {
    const r1 = enforceRateLimit("k", 5, 60);
    const r2 = enforceRateLimit("k", 5, 60);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });
});
