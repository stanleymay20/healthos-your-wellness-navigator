// Public API for sending transactional email. Each helper wraps a pure
// template with the underlying send call, so callers stay one line and
// don't need to know about Resend's shape.
//
// Every helper returns a SendEmailResult — the caller decides whether
// a failure should block the surrounding business action. In practice
// none of these emails are safety-critical (they confirm actions the
// user already took), so wire sites should log the result and continue.

import { sendEmail, type SendEmailResult } from "./resend.server";
import { deletionScheduled } from "./templates/deletion-scheduled";
import { deletionCancelled } from "./templates/deletion-cancelled";

export type { SendEmailResult } from "./resend.server";

export async function sendDeletionScheduledEmail(args: {
  to: string;
  scheduledFor: Date;
  graceDays: number;
}): Promise<SendEmailResult> {
  const body = deletionScheduled({
    scheduledFor: args.scheduledFor,
    graceDays: args.graceDays,
  });
  return sendEmail({
    to: args.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    event: "email.deletion_scheduled",
  });
}

export async function sendDeletionCancelledEmail(args: {
  to: string;
}): Promise<SendEmailResult> {
  const body = deletionCancelled();
  return sendEmail({
    to: args.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
    event: "email.deletion_cancelled",
  });
}
