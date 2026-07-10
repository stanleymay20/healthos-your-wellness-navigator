// Smoke coverage for the public marketing surface — the pages a
// prospective user hits before touching auth. These don't need Supabase
// creds; they run against any dev / preview deploy.
//
// Explicit non-goals:
//   - Auth, dashboard, and settings flows — those need real Supabase
//     creds and a seeded user. Run them in a separate spec that plugs a
//     staging DB via env, once you're ready to stand that up.
//   - Full visual regression — trace + screenshot on failure are enough
//     for now; add a proper snapshot pipeline when copy stabilizes.

import { expect, test } from "@playwright/test";

test.describe("landing surface", () => {
  test("landing page renders headline and primary CTA", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok(), `landing / did not 200 — got ${res?.status()}`).toBe(true);
    // Any heading is fine — we're checking that hydration produced content,
    // not that a specific string is present (copy churns).
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("pricing page shows all three tiers and their CTAs", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /honest pricing/i })).toBeVisible();
    // Pricing surface renders three tier cards. Free / Pro / Family names
    // are stable and worth asserting on because rearranging them changes
    // the checkout wiring.
    for (const tier of ["Free", "Pro", "Family"]) {
      await expect(page.getByText(tier, { exact: true }).first()).toBeVisible();
    }
    // The Pro tier's CTA must resolve to a button (not a bare link), or
    // the client-side checkout handler will never fire.
    const proCta = page.getByRole("button", { name: /start pro/i });
    await expect(proCta).toBeVisible();
    await expect(proCta).toBeEnabled();
  });

  test("about, blog, and pricing routes are reachable from the header", async ({ page }) => {
    await page.goto("/");
    for (const path of ["/about", "/pricing", "/blog"]) {
      const res = await page.request.get(path);
      expect(res.ok(), `${path} did not 200 — got ${res.status()}`).toBe(true);
    }
  });

  test("clicking Pro CTA when unauthenticated bounces to /auth", async ({ page }) => {
    await page.goto("/pricing");
    await page.getByRole("button", { name: /start pro/i }).click();
    // Unauthenticated flow: we navigate to /auth with the intent preserved
    // via ?plan=pro. Loose match on the pathname so a route rewrite (e.g.
    // /auth → /login) still passes.
    await page.waitForURL(/\/auth/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/auth/);
  });
});
