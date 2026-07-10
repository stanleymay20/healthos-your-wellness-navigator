// Zero-dep Stripe client. Talks to the REST API via fetch and implements
// the exact HMAC-SHA256 scheme Stripe documents for webhook verification.
// Same rationale as the Sentry / Resend clients — the surface we use is
// small enough that the SDK's convenience is not worth a fresh dep.
//
// See docs/runbooks/billing.md for setup and rotation.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-06-20";

// How far apart the header timestamp and server clock may be before we
// reject a webhook as replayed. Stripe's own SDK defaults to 5 minutes.
const WEBHOOK_TOLERANCE_SEC = 300;

export function isConfigured(): boolean {
  return STRIPE_SECRET_KEY.length > 0;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------
//
// Stripe signs every webhook payload. The signature lives in the
// `Stripe-Signature` header, formatted:
//
//   t=<unix ts>,v1=<sig>,v1=<sig2>,v0=<legacy>
//
// The signing string is `${t}.${rawBody}`. HMAC-SHA256 with the endpoint
// secret; hex-encoded; constant-time compared. Multiple `v1` entries mean
// "we're rotating; accept either" — treat any match as valid.
//
// If any invariant fails (missing header, expired timestamp, no matching
// sig), verifyWebhookSignature returns `null` and callers reject the
// request. Never throws — a thrown error in a Worker becomes a 500 and
// Stripe will retry, which we don't want for a genuine forgery attempt.

export type VerifiedWebhook = {
  timestamp: number;
  event: Record<string, unknown>;
};

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<VerifiedWebhook | null> {
  if (!signatureHeader || !webhookSecret) return null;

  const parts = signatureHeader.split(",").map((s) => s.trim());
  const tsRaw = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!tsRaw || sigs.length === 0) return null;

  const timestamp = Number(tsRaw);
  if (!Number.isFinite(timestamp)) return null;
  if (Math.abs(nowSec - timestamp) > WEBHOOK_TOLERANCE_SEC) return null;

  const signingPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(webhookSecret, signingPayload);

  // Constant-time compare against every provided sig — Stripe supports
  // rotating endpoint secrets, so multiple v1 entries may appear.
  const anyMatch = sigs.some((s) => timingSafeEqualHex(s, expected));
  if (!anyMatch) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
  return { timestamp, event: parsed };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToHex(new Uint8Array(mac));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Constant-time compare of two hex strings. Bails out at "not the same
// length" — different-length signatures never match, and revealing the
// length mismatch does not leak anything about the secret.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// REST helpers — checkout + billing portal
// ---------------------------------------------------------------------------

async function stripeFetch(
  path: string,
  form: Record<string, string>,
): Promise<Record<string, unknown>> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  const body = new URLSearchParams(form).toString();
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION,
    },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = (json.error ?? {}) as { message?: string; type?: string };
    throw new Error(`stripe ${path} ${res.status}: ${errObj.message ?? "unknown"}`);
  }
  return json;
}

export type CheckoutSessionInput = {
  userId: string;
  userEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  // Reuse an existing Stripe customer id when the user already has a
  // subscription record. Optional on first-time checkout — Stripe will
  // create one from `customer_email`.
  customerId?: string;
};

export type CheckoutSessionResult = {
  id: string;
  url: string;
};

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  const form: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // Stripe requires either customer or customer_email for subscription
    // checkout — client_reference_id lets the webhook map back to our
    // user without a lookup by email.
    client_reference_id: input.userId,
    "metadata[user_id]": input.userId,
    // Prefer the existing customer id so we don't create a duplicate
    // Customer object on second-time checkout.
    ...(input.customerId
      ? { customer: input.customerId }
      : { customer_email: input.userEmail }),
  };
  const json = await stripeFetch("/checkout/sessions", form);
  return {
    id: String(json.id ?? ""),
    url: String(json.url ?? ""),
  };
}

export type BillingPortalInput = {
  customerId: string;
  returnUrl: string;
};

export type BillingPortalResult = {
  id: string;
  url: string;
};

export async function createBillingPortalSession(
  input: BillingPortalInput,
): Promise<BillingPortalResult> {
  const json = await stripeFetch("/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return {
    id: String(json.id ?? ""),
    url: String(json.url ?? ""),
  };
}
