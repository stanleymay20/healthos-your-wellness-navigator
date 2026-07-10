import type { EmailBody } from "./deletion-scheduled";

export function deletionCancelled(): EmailBody {
  const subject = "Your HealthOS deletion request was cancelled";
  const text = [
    "Hi,",
    "",
    "You (or someone signed into your account) cancelled the pending",
    "deletion of your HealthOS account. Your data is safe and no further",
    "action is needed.",
    "",
    "If you did not cancel this request, sign in immediately, rotate your",
    "password, and re-request deletion from Settings → Account.",
    "",
    "— HealthOS",
  ].join("\n");
  const html = [
    `<p>Hi,</p>`,
    `<p>You (or someone signed into your account) cancelled the pending deletion of your HealthOS account. Your data is safe and no further action is needed.</p>`,
    `<p>If you did not cancel this request, sign in immediately, rotate your password, and re-request deletion from <em>Settings → Account</em>.</p>`,
    `<p>— HealthOS</p>`,
  ].join("");
  return { subject, html, text };
}
