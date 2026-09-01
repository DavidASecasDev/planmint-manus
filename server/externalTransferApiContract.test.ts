import { describe, expect, it } from "vitest";
import {
  buildExternalRequestHash,
  cancelExternalTransferSchema,
  createExternalTransferSchema,
  createWebhookSchema,
  idempotencyKeySchema,
  stableJson,
} from "./externalTransferApiContract";

const validPayload = {
  client_type: "villa" as const,
  client_name: "Cliente sintético",
  client_phone: "+34000000000",
  villa_name: "Villa sintética",
  external_reference: "CRM-001",
  items: [
    {
      direction: "ida" as const,
      transfer_date: "2026-09-18",
      transfer_time: "10:30",
      pickup_location: "Origen sintético",
      dropoff_location: "Destino sintético",
      vehicle_type: "mercedes_v_class" as const,
      pax_count: 4,
      luggage_count: 3,
      vans_needed: 1,
    },
  ],
};

describe("externalTransferApiContract", () => {
  it("accepts the canonical portal fields and applies safe defaults", () => {
    const parsed = createExternalTransferSchema.parse(validPayload);
    expect(parsed.items[0]).toMatchObject({
      baby_seats_count: 0,
      baby_seats: [],
      luggage_count: 3,
      vans_needed: 1,
    });
  });

  it("rejects invalid calendar dates, times and unsupported vehicle types", () => {
    const result = createExternalTransferSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], transfer_date: "2026-02-31", transfer_time: "25:70", vehicle_type: "sedan" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires the client-specific villa or charter name", () => {
    expect(createExternalTransferSchema.safeParse({ ...validPayload, villa_name: undefined }).success).toBe(false);
    expect(createExternalTransferSchema.safeParse({ ...validPayload, client_type: "charter", villa_name: undefined }).success).toBe(false);
  });

  it("validates linked item positions and prevents self-links", () => {
    const result = createExternalTransferSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], linked_item_position: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("requires baby-seat details to match the declared count when details are supplied", () => {
    const result = createExternalTransferSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], baby_seats_count: 2, baby_seats: [{ age: 3, weight: 15 }] }],
    });
    expect(result.success).toBe(false);
  });

  it("builds the same hash regardless of object key order", () => {
    const parsed = createExternalTransferSchema.parse(validPayload);
    const reordered = JSON.parse(stableJson(parsed));
    expect(buildExternalRequestHash(parsed)).toBe(buildExternalRequestHash(reordered));
  });

  it("requires an explicit, constrained idempotency key", () => {
    expect(idempotencyKeySchema.safeParse("crm:transfer:0001").success).toBe(true);
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("contains spaces").success).toBe(false);
  });

  it("requires meaningful cancellation reasons", () => {
    expect(cancelExternalTransferSchema.safeParse({ reason: "Cliente cancela el servicio" }).success).toBe(true);
    expect(cancelExternalTransferSchema.safeParse({ reason: "no" }).success).toBe(false);
  });

  it("accepts only HTTPS webhook URLs and known events", () => {
    expect(createWebhookSchema.safeParse({
      name: "CRM",
      url: "https://crm.example.com/planmint",
      events: ["transfer.status_changed"],
    }).success).toBe(true);
    expect(createWebhookSchema.safeParse({
      name: "CRM",
      url: "http://localhost/hook",
      events: ["transfer.status_changed"],
    }).success).toBe(false);
  });
});
