import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ExternalTransferApiFixture isolation", () => {
  const fixture = readFileSync(resolve(process.cwd(), "client/src/visual-fixtures/ExternalTransferApiFixture.tsx"), "utf8");
  const vite = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");

  it("contains no Supabase client, fetch, real key or customer data", () => {
    expect(fixture).not.toContain("supabase");
    expect(fixture).not.toContain("fetch(");
    expect(fixture).not.toMatch(/pmk_[a-f0-9]{8}_[a-f0-9]{32}/);
    expect(fixture).toContain("********************************");
  });

  it("is mounted only by the development Vite server", () => {
    expect(vite).toContain('/__fixtures/external-transfer-api');
    expect(fixture).toContain("Clave mostrada una sola vez");
    expect(fixture).toContain("Webhooks firmados");
  });
});
