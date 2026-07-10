// Focused on the security-critical webhook verifier. Every rejection
// path is exercised — a regression here would let a forger pass fake
// events. HTTP-client wrappers are not tested at this layer; those are
// thin URLSearchParams builders exercised by integration tests.

import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./stripe.server";

const SECRET = "whsec_test_1234567890abcdef";

async function signPayload(rawBody: string, timestamp: number, secret = SECRET): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`));
  const bytes = new Uint8Array(mac);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return `t=${timestamp},v1=${hex}`;
}

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ id: "evt_test", type: "customer.subscription.updated" });
  const ts = 1_700_000_000; // fixed test clock

  it("accepts a correctly signed payload within tolerance", async () => {
    const sig = await signPayload(body, ts);
    const out = await verifyWebhookSignature(body, sig, SECRET, ts);
    expect(out).not.toBeNull();
    expect(out!.timestamp).toBe(ts);
    expect((out!.event as { id: string }).id).toBe("evt_test");
  });

  it("rejects a tampered body", async () => {
    const sig = await signPayload(body, ts);
    const tampered = body.replace("evt_test", "evt_hijack");
    const out = await verifyWebhookSignature(tampered, sig, SECRET, ts);
    expect(out).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const sig = (await signPayload(body, ts)).replace(/v1=[0-9a-f]+/, "v1=00" + "aa".repeat(31));
    const out = await verifyWebhookSignature(body, sig, SECRET, ts);
    expect(out).toBeNull();
  });

  it("rejects a payload signed by a different secret", async () => {
    const sig = await signPayload(body, ts, "whsec_wrong_secret");
    const out = await verifyWebhookSignature(body, sig, SECRET, ts);
    expect(out).toBeNull();
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const sig = await signPayload(body, ts);
    // Server clock is 10 minutes ahead → outside the 5-minute window.
    const out = await verifyWebhookSignature(body, sig, SECRET, ts + 600);
    expect(out).toBeNull();
  });

  it("accepts a stale timestamp within the tolerance window", async () => {
    const sig = await signPayload(body, ts);
    // Server clock is 4 minutes ahead → still inside the 5-minute window.
    const out = await verifyWebhookSignature(body, sig, SECRET, ts + 240);
    expect(out).not.toBeNull();
  });

  it("rejects when the signature header is missing", async () => {
    const out = await verifyWebhookSignature(body, null, SECRET, ts);
    expect(out).toBeNull();
  });

  it("rejects when no v1 signature is present (v0 legacy is not accepted)", async () => {
    const out = await verifyWebhookSignature(body, `t=${ts},v0=deadbeef`, SECRET, ts);
    expect(out).toBeNull();
  });

  it("rejects when the secret is empty", async () => {
    const sig = await signPayload(body, ts);
    const out = await verifyWebhookSignature(body, sig, "", ts);
    expect(out).toBeNull();
  });

  it("rejects malformed JSON in the body even if the signature matches", async () => {
    const bad = "not json {";
    const sig = await signPayload(bad, ts);
    const out = await verifyWebhookSignature(bad, sig, SECRET, ts);
    expect(out).toBeNull();
  });

  it("accepts a valid signature when a rotated (extra) v1 is present", async () => {
    const validSig = await signPayload(body, ts);
    const rotated = `${validSig},v1=${"aa".repeat(32)}`; // append junk signature
    const out = await verifyWebhookSignature(body, rotated, SECRET, ts);
    expect(out).not.toBeNull();
  });
});
