import { describe, expect, it } from "vitest";
import { triggerTokenRefresh, type TokenRefreshEnv } from "./worker-token-refresh";

const env: TokenRefreshEnv = {
  TOKEN_REFRESH_CRON_TARGET_URL: "https://example.test/api/admin/oura-token-refresh-cron",
  TOKEN_REFRESH_CRON_SECRET: "s3cr3t",
};

describe("triggerTokenRefresh", () => {
  it("POSTs the target with the x-token-refresh-secret header", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true, refreshed: 2 }), {
        status: 200,
      });
    };
    const out = await triggerTokenRefresh(env, fakeFetch as unknown as typeof fetch);
    expect(capturedUrl).toBe(env.TOKEN_REFRESH_CRON_TARGET_URL);
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers as HeadersInit);
    expect(headers.get("x-token-refresh-secret")).toBe("s3cr3t");
    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
  });

  it("reports non-2xx outcomes without throwing", async () => {
    const fakeFetch = async () => new Response("forbidden", { status: 403 });
    const out = await triggerTokenRefresh(env, fakeFetch as unknown as typeof fetch);
    expect(out.ok).toBe(false);
    expect(out.status).toBe(403);
    expect(out.bodyHead).toBe("forbidden");
  });

  it("throws when TOKEN_REFRESH_CRON_TARGET_URL is missing", async () => {
    await expect(
      triggerTokenRefresh({ ...env, TOKEN_REFRESH_CRON_TARGET_URL: "" }),
    ).rejects.toThrow(/TOKEN_REFRESH_CRON_TARGET_URL/);
  });

  it("throws when TOKEN_REFRESH_CRON_SECRET is missing", async () => {
    await expect(
      triggerTokenRefresh({ ...env, TOKEN_REFRESH_CRON_SECRET: "" }),
    ).rejects.toThrow(/TOKEN_REFRESH_CRON_SECRET/);
  });
});
