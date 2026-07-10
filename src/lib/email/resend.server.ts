// Server-side transactional email sender. Talks to Resend's HTTP API
// directly, so no SDK sits in package.json — same zero-dep pattern as
// the Sentry client. Enterprise-adequate for outbound mail; swap for
// the SDK later if we need scheduling, batch, or webhook features.
//
// Gated on RESEND_API_KEY. When the key is absent, `sendEmail` logs a
// warning, returns { ok: false, reason: "not_configured" }, and never
// throws — so a missing config doesn't break the flow that triggered
// the send (the underlying business action still succeeded).
//
// See docs/runbooks/transactional-email.md for how to configure.

import { logger } from "@/lib/log/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? "HealthOS <noreply@healthos.app>";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  // Sentry-like event name for the structured log.
  event: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "http_error" | "network_error"; detail?: string };

export function isConfigured(): boolean {
  return RESEND_API_KEY.length > 0;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    logger.warn({
      event: "email.skipped_not_configured",
      user_email: input.to,
      subject: input.subject,
      trigger: input.event,
    });
    return { ok: false, reason: "not_configured" };
  }

  const body = JSON.stringify({
    from: input.from ?? DEFAULT_FROM,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
  } catch (err) {
    logger.error({
      event: "email.network_error",
      user_email: input.to,
      trigger: input.event,
      error: (err as Error).message,
    });
    return { ok: false, reason: "network_error", detail: (err as Error).message };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    logger.error({
      event: "email.http_error",
      user_email: input.to,
      trigger: input.event,
      status: res.status,
      detail,
    });
    return { ok: false, reason: "http_error", detail: `${res.status} ${detail}` };
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  const id = json.id ?? "";
  logger.info({
    event: "email.sent",
    to: input.to,
    subject: input.subject,
    trigger: input.event,
    provider_id: id,
  });
  return { ok: true, id };
}
