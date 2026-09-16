import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

type LogSeverity = "info" | "warn" | "error";

type ErrorInput = {
  requestId?: string;
  userId?: string | null;
  route?: string;
  action: string;
  severity?: LogSeverity;
  error: unknown;
  metadata?: Json;
};

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function recordServerError(input: ErrorInput): Promise<void> {
  const error = toError(input.error);
  const payload = {
    request_id: input.requestId ?? crypto.randomUUID(),
    user_id: input.userId ?? null,
    route: input.route ?? null,
    action: input.action,
    severity: input.severity ?? "error",
    message: error.message.slice(0, 1000),
    stack: error.stack?.slice(0, 4000) ?? null,
    metadata: input.metadata ?? {},
  };

  console.error(JSON.stringify({ event: "server_error", ...payload }));

  const { error: insertError } = await supabaseAdmin.from("app_errors").insert(payload);
  if (insertError) {
    console.error(
      JSON.stringify({
        event: "server_error_persist_failed",
        request_id: payload.request_id,
        message: insertError.message,
      }),
    );
  }
}
