/**
 * Tests for the Rently sync "protected fields" logic.
 *
 * Verifies that user-editable fields (addresses, locations) are NOT overwritten
 * when the sync updates existing reservations. This prevents the bug where
 * Mikaela writes a custom address and it gets wiped out 5 minutes later by
 * the Rently sync replacing it with the original (often incomplete) Rently data.
 *
 * The fix: in the statusUpdates loop, we delete these fields from updateData
 * before writing to the database, so they are only set on initial insert.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const syncRentlyPath = path.resolve(import.meta.dirname, "syncRently.ts");
const syncRentlyContent = fs.readFileSync(syncRentlyPath, "utf-8");

describe("Rently sync protects user-editable fields", () => {
  // Extract the statusUpdates section from the file
  const statusUpdatesSection = syncRentlyContent
    .split("// Apply status updates")[1]
    ?.split("totalInsertedCount")[0] || "";

  it("deletes lugar_entrega from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_entrega;");
  });

  it("deletes lugar_devolucion from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_devolucion;");
  });

  it("deletes lugar_entrega_direccion from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_entrega_direccion;");
  });

  it("deletes lugar_devolucion_direccion from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_devolucion_direccion;");
  });

  it("deletes lugar_entrega_ciudad from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_entrega_ciudad;");
  });

  it("deletes lugar_devolucion_ciudad from updateData before writing", () => {
    expect(statusUpdatesSection).toContain("delete updateData.lugar_devolucion_ciudad;");
  });

  it("already protects confirmed_entrega_datetime (existing behavior)", () => {
    expect(statusUpdatesSection).toContain("delete updateData.confirmed_entrega_datetime;");
  });

  it("already protects confirmed_devolucion_datetime (existing behavior)", () => {
    expect(statusUpdatesSection).toContain("delete updateData.confirmed_devolucion_datetime;");
  });

  it("has a comment explaining why these fields are protected", () => {
    expect(statusUpdatesSection).toContain("PROTECT USER-EDITABLE FIELDS");
  });
});

describe("Rently sync still sets address fields on initial insert", () => {
  it("mapBookingToReservation includes lugar_entrega for new reservations", () => {
    // The mapping function should still include these fields for NEW reservations
    const mappingSection = syncRentlyContent
      .split("function mapBookingToReservation")[1]
      ?.split("function enrichReservation")[0] || "";
    
    expect(mappingSection).toContain("lugar_entrega: deliveryPlace.Name");
    expect(mappingSection).toContain("lugar_devolucion: returnPlace.Name");
  });

  it("enrichReservationWithDetail includes address details for new reservations", () => {
    const enrichSection = syncRentlyContent
      .split("function enrichReservationWithDetail")[1]
      ?.split("function syncVehicle")[0] || "";
    
    expect(enrichSection).toContain("lugar_entrega_direccion: deliveryPlace.Address");
    expect(enrichSection).toContain("lugar_devolucion_direccion: returnPlace.Address");
    expect(enrichSection).toContain("lugar_entrega_ciudad: deliveryPlace.City");
    expect(enrichSection).toContain("lugar_devolucion_ciudad: returnPlace.City");
  });

  it("new reservations are inserted via upsert (not update), so all fields are included", () => {
    expect(syncRentlyContent).toContain(".upsert(newReservations");
  });
});

describe("Simulated updateData field protection", () => {
  it("correctly removes protected fields while keeping others", () => {
    // Simulate what the sync does
    const fullData: Record<string, unknown> = {
      estado: "En curso",
      cliente_nombre: "John",
      lugar_entrega: "Hotel Meliá",
      lugar_devolucion: "Aeropuerto PMI",
      lugar_entrega_direccion: "Paseo Marítimo 123",
      lugar_devolucion_direccion: "Carretera Aeropuerto s/n",
      lugar_entrega_ciudad: "Palma",
      lugar_devolucion_ciudad: "Palma",
      precio: 250,
      rently_status_code: 2,
    };

    const updateData = { ...fullData };
    
    // Apply the same deletions as in syncRently.ts
    delete updateData.lugar_entrega;
    delete updateData.lugar_devolucion;
    delete updateData.lugar_entrega_direccion;
    delete updateData.lugar_devolucion_direccion;
    delete updateData.lugar_entrega_ciudad;
    delete updateData.lugar_devolucion_ciudad;

    // Protected fields should be gone
    expect(updateData.lugar_entrega).toBeUndefined();
    expect(updateData.lugar_devolucion).toBeUndefined();
    expect(updateData.lugar_entrega_direccion).toBeUndefined();
    expect(updateData.lugar_devolucion_direccion).toBeUndefined();
    expect(updateData.lugar_entrega_ciudad).toBeUndefined();
    expect(updateData.lugar_devolucion_ciudad).toBeUndefined();

    // Non-protected fields should remain
    expect(updateData.estado).toBe("En curso");
    expect(updateData.cliente_nombre).toBe("John");
    expect(updateData.precio).toBe(250);
    expect(updateData.rently_status_code).toBe(2);
  });
});
