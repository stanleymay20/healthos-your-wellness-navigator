import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isKnownPlan, KNOWN_PLANS, planForPriceId, priceIdForPlan } from "./plans";

describe("KNOWN_PLANS", () => {
  it("lists exactly the plans the UI offers", () => {
    expect([...KNOWN_PLANS]).toEqual(["pro", "family"]);
  });
});

describe("isKnownPlan", () => {
  it("accepts pro and family", () => {
    expect(isKnownPlan("pro")).toBe(true);
    expect(isKnownPlan("family")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isKnownPlan("free")).toBe(false);
    expect(isKnownPlan("")).toBe(false);
    expect(isKnownPlan("PRO")).toBe(false);
    expect(isKnownPlan("family_annual")).toBe(false);
  });
});

describe("priceIdForPlan / planForPriceId", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = "price_pro_test";
    process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY = "price_family_test";
  });
  afterEach(() => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    delete process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY;
  });

  it("reads the env-driven price id", () => {
    expect(priceIdForPlan("pro")).toBe("price_pro_test");
    expect(priceIdForPlan("family")).toBe("price_family_test");
  });

  it("returns null when the env var is unset", () => {
    delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    expect(priceIdForPlan("pro")).toBeNull();
  });

  it("maps a known Stripe price back to the local plan slug", () => {
    expect(planForPriceId("price_pro_test")).toBe("pro");
    expect(planForPriceId("price_family_test")).toBe("family");
  });

  it("returns null for an unmapped Stripe price", () => {
    expect(planForPriceId("price_legacy_2023")).toBeNull();
  });
});
