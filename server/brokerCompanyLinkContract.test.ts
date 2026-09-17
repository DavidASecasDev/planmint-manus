import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const tableSource = fs.readFileSync(
  path.resolve(__dirname, "../client/src/components/transfers/BrokerTable.tsx"),
  "utf8"
);
const managementSource = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/transfers/BrokerManagement.tsx"),
  "utf8"
);
const listEndpointSource = fs.readFileSync(
  path.resolve(__dirname, "brokerListEndpoint.ts"),
  "utf8"
);
const serverIndexSource = fs.readFileSync(
  path.resolve(__dirname, "_core/index.ts"),
  "utf8"
);

describe("broker company link UI and route contract", () => {
  it("shows a Vincular a empresa action for configured but incomplete portal users", () => {
    expect(tableSource).toContain("Vincular a empresa");
    expect(tableSource).toContain("broker.user_id && profileHealth[broker.id]?.can_link_company");
    expect(tableSource).toContain("profileHealth[broker.id]?.can_link_company &&");
    expect(tableSource).toContain("border-amber-300 bg-amber-50");
    expect(tableSource).toContain("link-broker-company");
  });

  it("explains that the descriptive company field is not changed", () => {
    expect(tableSource).toContain("El texto del campo «Empresa» no se modificará");
  });

  it("uses the authenticated organization name in the confirmation", () => {
    expect(managementSource).toContain("organizationName={organization?.name || 'esta empresa'}");
    expect(tableSource).toContain("¿Vincular a {organizationName}?");
  });

  it("diagnoses both the main profile and broker portal profile", () => {
    expect(listEndpointSource).toContain('.from("profiles")');
    expect(listEndpointSource).toContain('.from("broker_profiles")');
    expect(listEndpointSource).toContain("is_linked: profileMatches && brokerProfileMatches");
    expect(listEndpointSource).toContain("can_link_company:");
  });

  it("protects the service-role listing with broker-management permissions", () => {
    expect(listEndpointSource).toContain("requireAnyPermission");
    expect(listEndpointSource).toContain('"transfers.manage_brokers"');
    expect(listEndpointSource).toContain('"transfers.manage"');
  });

  it("registers the authenticated endpoint in the Express server", () => {
    expect(serverIndexSource).toContain('import { handleLinkBrokerCompany } from "../linkBrokerCompany"');
    expect(serverIndexSource).toContain('app.post("/api/link-broker-company", handleLinkBrokerCompany)');
  });
});
