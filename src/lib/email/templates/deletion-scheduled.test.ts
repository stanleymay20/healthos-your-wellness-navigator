import { describe, expect, it } from "vitest";
import { deletionScheduled } from "./deletion-scheduled";
import { deletionCancelled } from "./deletion-cancelled";

describe("deletionScheduled template", () => {
  const scheduledFor = new Date("2026-05-28T00:00:00.000Z");

  it("renders subject, html and text with the scheduled date", () => {
    const out = deletionScheduled({ scheduledFor, graceDays: 30 });
    expect(out.subject).toMatch(/scheduled for deletion/i);
    expect(out.text).toContain("Thursday, May 28, 2026");
    expect(out.html).toContain("Thursday, May 28, 2026");
  });

  it("names the grace-days count in both bodies", () => {
    const out = deletionScheduled({ scheduledFor, graceDays: 30 });
    expect(out.text).toContain("30 days");
    expect(out.html).toContain("30 days");
  });

  it("carries the reset-your-password fallback in both bodies", () => {
    const out = deletionScheduled({ scheduledFor, graceDays: 30 });
    expect(out.text).toMatch(/did not request this deletion/i);
    expect(out.html).toMatch(/did not request this deletion/i);
  });
});

describe("deletionCancelled template", () => {
  it("renders subject, html and text", () => {
    const out = deletionCancelled();
    expect(out.subject).toMatch(/cancelled/i);
    expect(out.text).toMatch(/data is safe/i);
    expect(out.html).toMatch(/data is safe/i);
  });

  it("carries the compromise-warning fallback in both bodies", () => {
    const out = deletionCancelled();
    expect(out.text).toMatch(/did not cancel/i);
    expect(out.html).toMatch(/did not cancel/i);
  });
});
