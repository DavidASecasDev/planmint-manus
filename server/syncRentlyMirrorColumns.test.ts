import { describe, it, expect } from "vitest";

/**
 * Tests for the rently_* mirror columns feature.
 * These columns store the original Rently values so the UI can detect
 * manual edits and offer a "Restore from Rently" button.
 */

describe("Rently Mirror Columns - Sync Logic", () => {
  // Simulate the updateData transformation that happens in syncRently.ts
  function simulateSyncUpdate(fullData: Record<string, unknown>) {
    const updateData: Record<string, unknown> = { ...fullData };
    delete updateData.organization_id;
    delete updateData.imported_by;
    delete updateData.external_reservation_id;
    delete updateData.confirmed_entrega_datetime;
    delete updateData.confirmed_devolucion_datetime;

    // Mirror columns: always update rently_* with the Rently values
    updateData.rently_lugar_entrega = updateData.lugar_entrega ?? null;
    updateData.rently_lugar_devolucion = updateData.lugar_devolucion ?? null;
    updateData.rently_lugar_entrega_direccion = updateData.lugar_entrega_direccion ?? null;
    updateData.rently_lugar_devolucion_direccion = updateData.lugar_devolucion_direccion ?? null;

    // Protect user-editable fields
    delete updateData.lugar_entrega;
    delete updateData.lugar_devolucion;
    delete updateData.lugar_entrega_direccion;
    delete updateData.lugar_devolucion_direccion;
    delete updateData.lugar_entrega_ciudad;
    delete updateData.lugar_devolucion_ciudad;

    return updateData;
  }

  it("should set rently_* mirror columns from fullData values", () => {
    const fullData = {
      lugar_entrega: "Aeropuerto PMI",
      lugar_devolucion: "Oficina Centro",
      lugar_entrega_direccion: "Carretera Palma 123",
      lugar_devolucion_direccion: "Calle Mayor 45",
      lugar_entrega_ciudad: "Palma",
      lugar_devolucion_ciudad: "Palma",
      estado: "Confirmada",
    };

    const result = simulateSyncUpdate(fullData);

    expect(result.rently_lugar_entrega).toBe("Aeropuerto PMI");
    expect(result.rently_lugar_devolucion).toBe("Oficina Centro");
    expect(result.rently_lugar_entrega_direccion).toBe("Carretera Palma 123");
    expect(result.rently_lugar_devolucion_direccion).toBe("Calle Mayor 45");
  });

  it("should delete user-editable lugar fields from updateData", () => {
    const fullData = {
      lugar_entrega: "Aeropuerto PMI",
      lugar_devolucion: "Oficina Centro",
      lugar_entrega_direccion: "Carretera Palma 123",
      lugar_devolucion_direccion: "Calle Mayor 45",
      lugar_entrega_ciudad: "Palma",
      lugar_devolucion_ciudad: "Palma",
      estado: "Confirmada",
    };

    const result = simulateSyncUpdate(fullData);

    expect(result.lugar_entrega).toBeUndefined();
    expect(result.lugar_devolucion).toBeUndefined();
    expect(result.lugar_entrega_direccion).toBeUndefined();
    expect(result.lugar_devolucion_direccion).toBeUndefined();
    expect(result.lugar_entrega_ciudad).toBeUndefined();
    expect(result.lugar_devolucion_ciudad).toBeUndefined();
  });

  it("should set rently_* to null when fullData has null values", () => {
    const fullData = {
      lugar_entrega: null,
      lugar_devolucion: null,
      lugar_entrega_direccion: null,
      lugar_devolucion_direccion: null,
      estado: "Confirmada",
    };

    const result = simulateSyncUpdate(fullData);

    expect(result.rently_lugar_entrega).toBeNull();
    expect(result.rently_lugar_devolucion).toBeNull();
    expect(result.rently_lugar_entrega_direccion).toBeNull();
    expect(result.rently_lugar_devolucion_direccion).toBeNull();
  });

  it("should preserve non-address fields in updateData", () => {
    const fullData = {
      lugar_entrega: "Aeropuerto PMI",
      lugar_devolucion: "Oficina Centro",
      lugar_entrega_direccion: "Carretera Palma 123",
      lugar_devolucion_direccion: "Calle Mayor 45",
      estado: "Confirmada",
      precio: 150,
      modelo: "Seat Ibiza",
    };

    const result = simulateSyncUpdate(fullData);

    expect(result.estado).toBe("Confirmada");
    expect(result.precio).toBe(150);
    expect(result.modelo).toBe("Seat Ibiza");
  });
});

describe("Rently Mirror Columns - Frontend Detection Logic", () => {
  function isManuallyEdited(current: string | null, rently: string | null): boolean {
    return !!(current && rently && current.trim() !== rently.trim());
  }

  it("should detect when address was manually edited", () => {
    expect(isManuallyEdited("Parking G - Terminal 2", "Aeropuerto PMI")).toBe(true);
  });

  it("should NOT flag as edited when values are the same", () => {
    expect(isManuallyEdited("Aeropuerto PMI", "Aeropuerto PMI")).toBe(false);
  });

  it("should NOT flag as edited when values differ only in whitespace", () => {
    expect(isManuallyEdited("Aeropuerto PMI ", "Aeropuerto PMI")).toBe(false);
  });

  it("should NOT flag as edited when current is null", () => {
    expect(isManuallyEdited(null, "Aeropuerto PMI")).toBe(false);
  });

  it("should NOT flag as edited when rently value is null", () => {
    expect(isManuallyEdited("Aeropuerto PMI", null)).toBe(false);
  });

  it("should NOT flag as edited when both are null", () => {
    expect(isManuallyEdited(null, null)).toBe(false);
  });

  it("should detect edit even with partial text change", () => {
    expect(isManuallyEdited("Aeropuerto PMI - Llegadas", "Aeropuerto PMI")).toBe(true);
  });
});
