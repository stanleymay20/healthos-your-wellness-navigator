// Pure template. No I/O, no DB — takes inputs and returns strings.
// Test file exercises the output directly.

export type DeletionScheduledInput = {
  scheduledFor: Date;
  graceDays: number;
};

export type EmailBody = {
  subject: string;
  html: string;
  text: string;
};

function formatDate(d: Date): string {
  // "Monday, April 28, 2026" — matches what a user would read in a
  // confirmation message. Uses UTC so tests are locale-independent.
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function deletionScheduled(input: DeletionScheduledInput): EmailBody {
  const dateStr = formatDate(input.scheduledFor);
  const subject = "Your HealthOS account is scheduled for deletion";
  const text = [
    "Hi,",
    "",
    `We've scheduled your HealthOS account for deletion on ${dateStr}.`,
    "",
    `You have ${input.graceDays} days to change your mind. Sign in and`,
    "open Settings → Account to cancel the request. After the scheduled",
    "date, your data will be permanently removed — this cannot be undone.",
    "",
    "If you did not request this deletion, please cancel it and rotate",
    "your account password.",
    "",
    "— HealthOS",
  ].join("\n");
  const html = [
    `<p>Hi,</p>`,
    `<p>We've scheduled your HealthOS account for deletion on <strong>${dateStr}</strong>.</p>`,
    `<p>You have ${input.graceDays} days to change your mind. Sign in and open <em>Settings → Account</em> to cancel the request. After the scheduled date, your data will be permanently removed — this cannot be undone.</p>`,
    `<p>If you did not request this deletion, please cancel it and rotate your account password.</p>`,
    `<p>— HealthOS</p>`,
  ].join("");
  return { subject, html, text };
}
