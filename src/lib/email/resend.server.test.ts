// Tests the send path against a fake Resend API. The module is gated on
// RESEND_API_KEY, which vitest doesn't set — so the default is a "not
// configured" branch. Individual tests override process.env inline.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = "https://api.resend.com/emails";

async function loadModule() {
  vi.resetModules();
  return await import("./resend.server");
}

describe("sendEmail — not configured", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns not_configured when RESEND_API_KEY is unset", async () => {
    const { sendEmail, isConfigured } = await loadModule();
    expect(isConfigured()).toBe(false);
    const res = await sendEmail({
      to: "u@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "h",
      event: "test.event",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_configured");
  });
});

describe("sendEmail — configured", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test_key";
    process.env.RESEND_FROM_EMAIL = "HealthOS <noreply@healthos.app>";
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("POSTs the Resend endpoint with bearer auth and returns the provider id", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ id: "resend_abc123" }), { status: 200 });
    }) as typeof fetch;

    const { sendEmail } = await loadModule();
    const res = await sendEmail({
      to: "u@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "h",
      event: "test.event",
    });

    expect(capturedUrl).toBe(ENDPOINT);
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer test_key");
    expect(headers.get("Content-Type")).toBe("application/json");

    const body = JSON.parse((capturedInit?.body as string) ?? "{}");
    expect(body.from).toBe("HealthOS <noreply@healthos.app>");
    expect(body.to).toEqual(["u@example.com"]);
    expect(body.subject).toBe("s");
    expect(body.html).toBe("<p>h</p>");
    expect(body.text).toBe("h");

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.id).toBe("resend_abc123");
  });

  it("reports http_error with the status when Resend returns non-2xx", async () => {
    globalThis.fetch = (async () =>
      new Response("bad input", { status: 422 })) as typeof fetch;
    const { sendEmail } = await loadModule();
    const res = await sendEmail({
      to: "u@example.com",
      subject: "s",
      html: "h",
      text: "h",
      event: "test.event",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("http_error");
      expect(res.detail).toContain("422");
    }
  });

  it("reports network_error when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;
    const { sendEmail } = await loadModule();
    const res = await sendEmail({
      to: "u@example.com",
      subject: "s",
      html: "h",
      text: "h",
      event: "test.event",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("network_error");
      expect(res.detail).toContain("ECONNREFUSED");
    }
  });
});
