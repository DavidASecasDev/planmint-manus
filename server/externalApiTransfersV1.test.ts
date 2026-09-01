import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const transfersSource = readFileSync(resolve(process.cwd(), "server/externalApiTransfers.ts"), "utf8");
const webhooksSource = readFileSync(resolve(process.cwd(), "server/externalApiWebhooks.ts"), "utf8");
const indexSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

describe("External Transfers API v1 architecture", () => {
  it("creates through the atomic idempotent RPC instead of count+1 and compensating deletes", () => {
    expect(transfersSource).toContain('idempotencyKeySchema.safeParse');
    expect(transfersSource).toContain('.rpc("create_external_transfer_v1"');
    expect(transfersSource).not.toContain("getNextRequestNumber");
    expect(transfersSource).not.toContain('.from("transfer_requests").delete()');
  });

  it("limits every read to the authenticated organization while including all creation channels", () => {
    expect(transfersSource.match(/\.eq\("organization_id", auth\.organizationId\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(transfersSource).not.toContain("broker_id", "The external list must not restrict visibility to one broker");
    expect(transfersSource).not.toContain("external_api_key_id", "The external list must not restrict visibility to API-created requests");
  });

  it("exposes the operational fields used by the current portal but no internal provider pricing", () => {
    for (const field of ["luggage_count", "vans_needed", "baby_seats_count", "pickup_lat", "dropoff_lng", "linked_item_id", "driver_name"]) {
      expect(transfersSource).toContain(field);
    }
    for (const internalField of ["provider_cost", "base_price", "price_with_commission", "internal_margin"]) {
      expect(transfersSource).not.toContain(internalField);
    }
  });

  it("cancels through the transactional RPC and queues state automation only once", () => {
    expect(transfersSource).toContain('.rpc("cancel_external_transfer_v1"');
    expect(transfersSource).toContain("if (!data.replayed)");
    expect(transfersSource).toContain("onTransferStatusChanged");
  });

  it("mounts transfers, webhooks, OpenAPI and scheduled delivery before the SPA fallback", () => {
    expect(indexSource).toContain('app.use("/api/external/v1/transfers"');
    expect(indexSource).toContain('app.use("/api/external/v1/webhooks"');
    expect(indexSource).toContain('app.get("/api/external/v1/openapi.json"');
    expect(indexSource).toContain('app.post("/api/scheduled/external-api-webhooks"');
    expect(indexSource.indexOf('/api/external/v1/openapi.json')).toBeLessThan(indexSource.lastIndexOf('setupVite('));
  });

  it("encrypts signing secrets and validates destinations for create, update and test delivery", () => {
    expect(webhooksSource).toContain("encryptWebhookSecret");
    expect(webhooksSource.match(/assertWebhookDestination/g)?.length).toBeGreaterThanOrEqual(2);
    expect(webhooksSource.match(/signing_secret:/g)?.length).toBe(2);
    expect(webhooksSource).not.toContain("response_excerpt:");
  });
});
