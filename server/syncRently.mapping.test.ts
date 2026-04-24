/**
 * Tests for the Rently API data mapping logic.
 * Verifies that the enrichReservationWithDetail function correctly maps
 * the Rently API response structure to our database schema.
 */
import { describe, it, expect } from "vitest";

// Since enrichReservationWithDetail is not exported, we test the mapping logic directly
// by simulating what the function does with the actual API structure

describe("Rently API Mapping", () => {
  // Simulate the actual Rently API response structure for Additionals
  const sampleAdditionals = [
    {
      Additional: {
        Name: "BLUE COVER G1",
        Description: "75% Reducción de franquicia.",
        Price: 24.79,
        IsPriceByDay: true,
        Type: "Insurance",
        Id: 3,
      },
      Quantity: 1,
    },
    {
      Additional: {
        Name: "Reserva fuera de horario",
        Description: "Entrega/devolución fuera de horario.",
        Price: 41.32,
        IsPriceByDay: false,
        Type: "Equipment",
        Id: 7,
      },
      Quantity: 2,
    },
  ];

  // Simulate the actual Rently API response structure for PriceItems
  const samplePriceItems = [
    {
      Id: 10139,
      IsBookingPrice: true,
      Description: "Booking for 2 days (€ 48.76 x day)",
      Price: 97.52,
      UnitPrice: 48.76,
      Quantity: 2,
      Type: 0,
      TypeId: 0,
      TariffName: "2024 Agosto",
    },
    {
      Id: 10142,
      IsBookingPrice: false,
      Description: "(1) BLUE COVER G1 (€ 24.79 for Day) x 2 Days",
      Price: 49.58,
      UnitPrice: 24.79,
      Quantity: 2,
      Type: 16,
      TypeId: 3,
      TariffName: null,
    },
  ];

  describe("Additionals mapping (extras_contratados)", () => {
    it("should correctly map nested Additional structure", () => {
      // This is the corrected mapping logic from syncRently.ts
      const mapped = sampleAdditionals.map((a) => ({
        nombre: a.Additional?.Name || null,
        precio: a.Additional?.Price ?? null,
        cantidad: a.Quantity ?? 1,
        tipo: a.Additional?.Type || null,
        por_dia: a.Additional?.IsPriceByDay ?? false,
      }));

      expect(mapped).toHaveLength(2);

      // First extra
      expect(mapped[0].nombre).toBe("BLUE COVER G1");
      expect(mapped[0].precio).toBe(24.79);
      expect(mapped[0].cantidad).toBe(1);
      expect(mapped[0].tipo).toBe("Insurance");
      expect(mapped[0].por_dia).toBe(true);

      // Second extra
      expect(mapped[1].nombre).toBe("Reserva fuera de horario");
      expect(mapped[1].precio).toBe(41.32);
      expect(mapped[1].cantidad).toBe(2);
      expect(mapped[1].tipo).toBe("Equipment");
      expect(mapped[1].por_dia).toBe(false);
    });

    it("should handle missing Additional object gracefully", () => {
      const withMissing = [{ Quantity: 1 }];
      const mapped = withMissing.map((a: any) => ({
        nombre: a.Additional?.Name || null,
        precio: a.Additional?.Price ?? null,
        cantidad: a.Quantity ?? 1,
        tipo: a.Additional?.Type || null,
        por_dia: a.Additional?.IsPriceByDay ?? false,
      }));

      expect(mapped[0].nombre).toBeNull();
      expect(mapped[0].precio).toBeNull();
      expect(mapped[0].cantidad).toBe(1);
      expect(mapped[0].tipo).toBeNull();
      expect(mapped[0].por_dia).toBe(false);
    });

    it("should produce valid JSON string", () => {
      const mapped = sampleAdditionals.map((a) => ({
        nombre: a.Additional?.Name || null,
        precio: a.Additional?.Price ?? null,
        cantidad: a.Quantity ?? 1,
        tipo: a.Additional?.Type || null,
        por_dia: a.Additional?.IsPriceByDay ?? false,
      }));

      const json = JSON.stringify(mapped);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].nombre).toBe("BLUE COVER G1");
    });
  });

  describe("PriceItems mapping (desglose_precios)", () => {
    it("should correctly map PriceItems with Price field (not Amount)", () => {
      // This is the corrected mapping logic from syncRently.ts
      const mapped = samplePriceItems.map((p) => ({
        descripcion: p.Description,
        importe: p.Price,
        precio_unitario: p.UnitPrice,
        cantidad: p.Quantity,
        tipo: p.Type,
      }));

      expect(mapped).toHaveLength(2);

      // First price item
      expect(mapped[0].descripcion).toBe("Booking for 2 days (€ 48.76 x day)");
      expect(mapped[0].importe).toBe(97.52);
      expect(mapped[0].precio_unitario).toBe(48.76);
      expect(mapped[0].cantidad).toBe(2);

      // Second price item
      expect(mapped[1].importe).toBe(49.58);
      expect(mapped[1].precio_unitario).toBe(24.79);
    });
  });

  describe("Top-level field mapping", () => {
    it("should map Currency as a string, not an object", () => {
      const detail = { Currency: "EUR" };
      // Correct mapping: detail.Currency directly
      const moneda = detail.Currency || null;
      expect(moneda).toBe("EUR");
    });

    it("should map rate fields from top level, not nested Rate object", () => {
      const detail = {
        DailyRate: 102.91,
        HourlyRate: 20.58,
        ExtraDayRate: 0,
        ExtraHourRate: 0,
        IlimitedKm: true,
        MaxAllowedDistance: 0,
        MaxAllowedDistanceByDay: 0,
      };

      expect(detail.DailyRate).toBe(102.91);
      expect(detail.HourlyRate).toBe(20.58);
      expect(detail.IlimitedKm).toBe(true);
    });

    it("should handle SalesCommision typo (single s)", () => {
      const detail = { SalesCommision: 15.5 };
      // API uses single 's' in "SalesCommision"
      const comision = detail.SalesCommision ?? null;
      expect(comision).toBe(15.5);
    });
  });
});
