// Playwright config — targets a running dev server (default
// http://localhost:8080). Point at a preview / staging deploy by setting
// PLAYWRIGHT_BASE_URL. Uses the pre-installed Chromium if available so a
// fresh clone doesn't have to download the browser.

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";

// Cloudflare's pre-baked Chromium — see the container environment notes.
// If PLAYWRIGHT_BROWSERS_PATH already points to a downloaded set, this is
// harmless; if it doesn't, we point at the mounted binary explicitly.
const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: CHROMIUM_EXECUTABLE },
      },
    },
  ],
});
