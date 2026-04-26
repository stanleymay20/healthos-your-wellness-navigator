// Server-only. Best-effort recorder for admin/operator-route invocations.
// Writes go through supabaseAdmin into public.admin_audit_log. Failures
// are logged but never thrown — auditing must not block the user-visible
// response.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/log/logger";

export type AuditOutcome =
  | "ok"
  | "rate_limited"
  | "config_missing"
  | "auth_failed"
  | "forbidden"
  | "validation_error"
  | "internal_error";

export type AdminAuditFields = {
  route: string;                 // e.g. "POST /api/admin/backfill-scores"
  callerIp?: string | null;
  callerUserId?: string | null;
  payloadDigest?: string | null; // hex SHA-256 of the raw body, when available
  outcome: AuditOutcome;
  statusCode: number;
  errorMessage?: string | null;
  details?: Record<string, unknown>;
};

const MAX_ERROR_LEN = 500;

export async function recordAdminAudit(fields: AdminAuditFields): Promise<void> {
  try {
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    await admin.from("admin_audit_log").insert({
      route: fields.route,
      caller_ip: fields.callerIp ?? null,
      caller_user_id: fields.callerUserId ?? null,
      payload_digest: fields.payloadDigest ?? null,
      outcome: fields.outcome,
      status_code: fields.statusCode,
      error_message: fields.errorMessage ? fields.errorMessage.slice(0, MAX_ERROR_LEN) : null,
      details: fields.details ?? null,
    });
  } catch (err) {
    logger.warn({
      event: "admin_audit.write_failed",
      route: fields.route,
      error: (err as Error).message,
    });
  }
}

// SHA-256(text) as lowercase hex. Used to record what payload an admin
// call carried without storing the body itself (which may contain user
// IDs or future PII). Returns null on failure so callers can record
// payload_digest=null without crashing.
export async function digestPayload(text: string): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(hash);
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  } catch {
    return null;
  }
}
