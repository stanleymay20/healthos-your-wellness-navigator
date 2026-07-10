import { describe, expect, it } from "vitest";
import { buildEvent, parseDsn } from "./sentry.server";

describe("parseDsn", () => {
  it("parses a standard Sentry DSN", () => {
    const p = parseDsn("https://abcd1234@o12345.ingest.sentry.io/42");
    expect(p).not.toBeNull();
    expect(p!.publicKey).toBe("abcd1234");
    expect(p!.host).toBe("o12345.ingest.sentry.io");
    expect(p!.projectId).toBe("42");
  });

  it("returns null for empty input", () => {
    expect(parseDsn("")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseDsn("not a url")).toBeNull();
  });

  it("returns null when the public key is missing", () => {
    expect(parseDsn("https://o12345.ingest.sentry.io/42")).toBeNull();
  });

  it("returns null when the project id is missing", () => {
    expect(parseDsn("https://abcd1234@o12345.ingest.sentry.io/")).toBeNull();
  });
});

describe("buildEvent", () => {
  const eventId = "0000000000000000000000000000abcd";
  const ts = "2026-04-28T00:00:00.000Z";

  it("captures message + type from an Error", () => {
    const err = new Error("boom");
    const event = buildEvent(err, {}, eventId, ts);
    const exc = (event.exception as { values: Array<{ type: string; value: string }> }).values[0];
    expect(exc.type).toBe("Error");
    expect(exc.value).toBe("boom");
    expect(event.event_id).toBe(eventId);
    expect(event.timestamp).toBe(ts);
    expect(event.level).toBe("error");
  });

  it("coerces a non-Error to a stringified message", () => {
    const event = buildEvent("just a string", {}, eventId, ts);
    const exc = (event.exception as { values: Array<{ type: string; value: string }> }).values[0];
    expect(exc.type).toBe("Error");
    expect(exc.value).toBe("just a string");
  });

  it("truncates very long messages", () => {
    const msg = "x".repeat(1000);
    const event = buildEvent(new Error(msg), {}, eventId, ts);
    const exc = (event.exception as { values: Array<{ type: string; value: string }> }).values[0];
    expect(exc.value.length).toBe(500);
  });

  it("copies route and userId into the event", () => {
    const event = buildEvent(
      new Error("bad"),
      { route: "POST /api/x", userId: "user-1", event: "some_event" },
      eventId,
      ts,
    );
    expect((event.tags as Record<string, string>).route).toBe("POST /api/x");
    expect((event.user as { id: string }).id).toBe("user-1");
    expect(event.logger).toBe("some_event");
  });

  it("merges custom tags on top of route tag", () => {
    const event = buildEvent(
      new Error("bad"),
      { route: "POST /api/x", tags: { provider: "oura" } },
      eventId,
      ts,
    );
    const tags = event.tags as Record<string, string>;
    expect(tags.route).toBe("POST /api/x");
    expect(tags.provider).toBe("oura");
  });

  it("parses a V8-style stack trace into oldest-first frames", () => {
    const err = new Error("bad");
    err.stack = [
      "Error: bad",
      "    at doStuff (/app/src/a.ts:10:5)",
      "    at handler (/app/src/b.ts:20:15)",
    ].join("\n");
    const event = buildEvent(err, {}, eventId, ts);
    const stacktrace = (
      event.exception as { values: Array<{ stacktrace?: { frames: Array<{ function?: string }> } }> }
    ).values[0].stacktrace;
    expect(stacktrace).toBeDefined();
    // Sentry expects oldest-first: last-in-stack (handler) comes before the innermost.
    expect(stacktrace!.frames[0].function).toBe("handler");
    expect(stacktrace!.frames[1].function).toBe("doStuff");
  });
});
