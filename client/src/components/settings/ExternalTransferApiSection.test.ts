import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ExternalTransferApiSection", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/components/settings/ExternalTransferApiSection.tsx"), "utf8");
  const settingsSource = readFileSync(resolve(process.cwd(), "client/src/pages/Settings.tsx"), "utf8");

  it("manages one shared key and shows every approved scope", () => {
    expect(source).toContain("Comerciales · Clave compartida");
    for (const scope of ["transfers.create", "transfers.read", "transfers.cancel", "webhooks.manage"]) {
      expect(source).toContain(scope);
    }
  });

  it("shows the secret only in the immediate create or rotate response", () => {
    expect(source).toContain("No volverá a mostrarse");
    expect(source).toContain("/rotate");
    expect(source).toContain("Revocar");
    expect(source).not.toContain("localStorage.setItem");
  });

  it("is visible through the same granular permission enforced by the server", () => {
    expect(settingsSource).toContain("hasPermission('integrations.manage_api_keys')");
    expect(settingsSource).toContain("canManageTransferApi && transfersEnabled");
  });
});
