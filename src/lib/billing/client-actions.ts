// Client-side helpers that trigger the billing routes. Kept tiny — the
// browser side of billing is fetch-then-redirect, nothing more.
//
// Both helpers return a Result rather than throwing so callers can surface
// specific errors (401 → sign in, 404 → no subscription, etc.) instead of
// a generic "something went wrong."

import type { PlanSlug } from "./plans";

export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string };

async function post(
  endpoint: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<BillingActionResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !json.url) {
    return {
      ok: false,
      status: res.status,
      error: json.error ?? `${res.status} ${res.statusText}`,
    };
  }
  return { ok: true, url: json.url };
}

export async function startCheckout(
  accessToken: string,
  plan: PlanSlug,
): Promise<BillingActionResult> {
  return post("/api/billing/checkout", accessToken, { plan });
}

export async function openBillingPortal(
  accessToken: string,
): Promise<BillingActionResult> {
  return post("/api/billing/portal", accessToken);
}
