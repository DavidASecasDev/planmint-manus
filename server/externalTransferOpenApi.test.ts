import { describe, expect, it } from "vitest";
import { externalTransferOpenApi } from "./externalTransferOpenApi";

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
});
