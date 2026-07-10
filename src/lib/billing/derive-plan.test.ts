import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { derivePlan } from "./derive-plan";

describe("derivePlan", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = "price_pro_test";
    process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY = "price_family_test";
  });
  afterEach(() => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    delete process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY;
  });

  it("returns the known plan slug when status is active", () => {
    const p = derivePlan({
      plan_slug: "pro",
      status: "active",
      current_period_end: "2026-05-28T00:00:00Z",
      cancel_at_period_end: false,
    });
    expect(p.plan).toBe("pro");
    expect(p.active).toBe(true);
    expect(p.currentPeriodEnd?.toISOString()).toBe("2026-05-28T00:00:00.000Z");
  });

  it("treats trialing and past_due as active", () => {
    for (const status of ["trialing", "past_due"]) {
      const p = derivePlan({
        plan_slug: "family",
        status,
        current_period_end: null,
        cancel_at_period_end: false,
      });
      expect(p.active).toBe(true);
      expect(p.plan).toBe("family");
    }
  });

  it("downgrades to free when status is canceled", () => {
    const p = derivePlan({
      plan_slug: "pro",
      status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
    });
    expect(p.plan).toBe("free");
    expect(p.active).toBe(false);
  });

  it("downgrades to free when plan_slug is unknown even if active", () => {
    // Represents the "we know they're paying, we can't label the plan"
    // case — e.g. a legacy price we discontinued.
    const p = derivePlan({
      plan_slug: "legacy_bundle",
      status: "active",
      current_period_end: null,
      cancel_at_period_end: false,
    });
    expect(p.plan).toBe("free");
    expect(p.active).toBe(true); // still active, just unlabeled
  });

  it("surfaces cancel_at_period_end for banner rendering", () => {
    const p = derivePlan({
      plan_slug: "pro",
      status: "active",
      current_period_end: "2026-05-28T00:00:00Z",
      cancel_at_period_end: true,
    });
    expect(p.cancelAtPeriodEnd).toBe(true);
  });

  it("always sets hasBillingRecord=true (row exists)", () => {
    const p = derivePlan({
      plan_slug: null,
      status: null,
      current_period_end: null,
      cancel_at_period_end: null,
    });
    expect(p.hasBillingRecord).toBe(true);
    // status=null means we haven't heard from Stripe yet — treat as
    // not-active-yet, sit on free until the subscription event arrives.
    expect(p.active).toBe(false);
    expect(p.plan).toBe("free");
  });
});
