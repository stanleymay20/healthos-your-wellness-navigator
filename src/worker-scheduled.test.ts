import { describe, expect, it } from "vitest";
import { triggerCron, type ScheduledEnv } from "./worker-scheduled";

const env: ScheduledEnv = {
  SYNC_CRON_TARGET_URL: "https://example.test/api/admin/oura-sync-cron",
  SYNC_CRON_SECRET: "s3cr3t",
};

describe("triggerCron", () => {
  it("POSTs the target with the x-sync-secret header", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true, usersScanned: 3 }), {
        status: 200,
      });
    };
    const out = await triggerCron(env, fakeFetch as unknown as typeof fetch);
    expect(capturedUrl).toBe(env.SYNC_CRON_TARGET_URL);
    expect(capturedInit?.method).toBe("POST");
    const headers = new Headers(capturedInit?.headers as HeadersInit);
    expect(headers.get("x-sync-secret")).toBe("s3cr3t");
    expect(out.ok).toBe(true);
    expect(out.status).toBe(200);
  });

  it("reports non-2xx outcomes without throwing", async () => {
    const fakeFetch = async () => new Response("forbidden", { status: 403 });
    const out = await triggerCron(env, fakeFetch as unknown as typeof fetch);
    expect(out.ok).toBe(false);
    expect(out.status).toBe(403);
    expect(out.bodyHead).toBe("forbidden");
  });

  it("throws when SYNC_CRON_TARGET_URL is missing", async () => {
    await expect(
      triggerCron({ ...env, SYNC_CRON_TARGET_URL: "" }),
    ).rejects.toThrow(/SYNC_CRON_TARGET_URL/);
  });

  it("throws when SYNC_CRON_SECRET is missing", async () => {
    await expect(
      triggerCron({ ...env, SYNC_CRON_SECRET: "" }),
    ).rejects.toThrow(/SYNC_CRON_SECRET/);
  });
});
