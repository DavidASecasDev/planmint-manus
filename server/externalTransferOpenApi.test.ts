import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { externalTransferOpenApi, handleExternalTransferRoot } from "./externalTransferOpenApi";

describe("externalTransferOpenApi", () => {
  it("documents every approved bidirectional operation", () => {
    expect(externalTransferOpenApi.paths).toHaveProperty("/transfers");
    expect(externalTransferOpenApi.paths).toHaveProperty("/transfers/{id}");
    expect(externalTransferOpenApi.paths).toHaveProperty("/transfers/{id}/cancel");
    expect(externalTransferOpenApi.paths).toHaveProperty("/webhooks");
    expect(externalTransferOpenApi.paths).toHaveProperty("/webhooks/{id}/test");
    expect(externalTransferOpenApi.paths["/transfers"].post.parameters[0]).toMatchObject({ name: "Idempotency-Key", required: true });
  });

  it("uses a shared API key security scheme and excludes internal financial fields", () => {
    expect(externalTransferOpenApi.components.securitySchemes.ApiKeyAuth).toMatchObject({ in: "header", name: "X-API-Key" });
    const serialized = JSON.stringify(externalTransferOpenApi);
    expect(serialized).not.toContain("provider_cost");
    expect(serialized).not.toContain("internal_margin");
    expect(serialized).not.toContain("price_with_commission");
  });

  it("redirects the public API root to the navigable documentation", () => {
    const setHeader = vi.fn();
    const redirect = vi.fn();
    handleExternalTransferRoot({} as never, { setHeader, redirect } as never);

    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=300");
    expect(redirect).toHaveBeenCalledWith(302, "/api/external/v1/docs");

    const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(indexSource).toContain('app.get("/api/external/v1", handleExternalTransferRoot)');
    expect(indexSource.indexOf('app.get("/api/external/v1", handleExternalTransferRoot)')).toBeLessThan(indexSource.indexOf("setupVite(app, server)"));
  });
});
