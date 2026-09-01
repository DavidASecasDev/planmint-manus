import { describe, expect, it } from "vitest";

describe("external webhook retry policy", () => {
  it("keeps retries bounded and never relies on an in-process interval", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./externalWebhookDispatcher.ts", import.meta.url), "utf8"));
    expect(source).toContain("claim_external_api_webhook_deliveries");
    expect(source).toContain("MAX_ATTEMPTS = 6");
    expect(source).not.toContain("setInterval(");
    expect(source).not.toContain("node-cron");
    expect(source).toContain("user.taskUid");
    expect(source).toContain("schedule_cron_task_uid");
  });
});
