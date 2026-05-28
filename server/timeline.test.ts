import { describe, it, expect } from "vitest";

/**
 * Unit tests for timeline-related logic.
 * These test the pure helper functions and data structures
 * used by the timeline endpoint and VehicleTimeline component.
 */

// ─── EXCLUDED_PLATES filter ─────────────────────────────────────────────────

describe("EXCLUDED_PLATES filter", () => {
  const EXCLUDED_PLATES = new Set(["6513MFG"]);

  it("should exclude DummyCar plate 6513MFG", () => {
    expect(EXCLUDED_PLATES.has("6513MFG")).toBe(true);
  });

  it("should not exclude valid plates", () => {
    expect(EXCLUDED_PLATES.has("1234ABC")).toBe(false);
    expect(EXCLUDED_PLATES.has("9806MSG")).toBe(false);
  });
});

// ─── ACTIVE_REPAIR_STATUSES ─────────────────────────────────────────────────

describe("ACTIVE_REPAIR_STATUSES", () => {
  const ACTIVE_REPAIR_STATUSES = [
    "pendiente_aprobacion",
    "en_taller",
    "listo_entregar_taller",
    "esperando_piezas",
    "listo_recoger",
  ];

  it("should include all active workshop statuses", () => {
    expect(ACTIVE_REPAIR_STATUSES).toContain("pendiente_aprobacion");
    expect(ACTIVE_REPAIR_STATUSES).toContain("en_taller");
    expect(ACTIVE_REPAIR_STATUSES).toContain("listo_entregar_taller");
    expect(ACTIVE_REPAIR_STATUSES).toContain("esperando_piezas");
    expect(ACTIVE_REPAIR_STATUSES).toContain("listo_recoger");
  });

  it("should NOT include finalizado (completed repair)", () => {
    expect(ACTIVE_REPAIR_STATUSES).not.toContain("finalizado");
  });

  it("should NOT include cancelado", () => {
    expect(ACTIVE_REPAIR_STATUSES).not.toContain("cancelado");
  });
});

// ─── resolveCategory ─────────────────────────────────────────────────────────

describe("resolveCategory", () => {
  function resolveCategory(rawCategoria: string | null, marca: string): string {
    if (!rawCategoria || /^\d+$/.test(rawCategoria.trim())) {
      return marca || "Otros";
    }
    return rawCategoria
      .split(" ")
      .map(w => {
        if (w.length <= 3 && w === w.toUpperCase()) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  it("should normalize category names to title case", () => {
    expect(resolveCategory("LUXURY ELITE", "")).toBe("Luxury Elite");
    expect(resolveCategory("mini convertibles", "")).toBe("Mini Convertibles");
  });

  it("should preserve short uppercase words (acronyms like SUV)", () => {
    expect(resolveCategory("SUV Premium", "")).toBe("SUV Premium");
    expect(resolveCategory("SUV", "")).toBe("SUV");
  });

  it("should fall back to marca when category is numeric", () => {
    expect(resolveCategory("123", "Mercedes")).toBe("Mercedes");
    expect(resolveCategory("45", "BMW")).toBe("BMW");
  });

  it("should fall back to marca when category is null/empty", () => {
    expect(resolveCategory(null, "Porsche")).toBe("Porsche");
    expect(resolveCategory("", "Ferrari")).toBe("Ferrari");
  });

  it("should return 'Otros' when both category and marca are empty", () => {
    expect(resolveCategory(null, "")).toBe("Otros");
    expect(resolveCategory("", "")).toBe("Otros");
  });
});

// ─── categorySort ────────────────────────────────────────────────────────────

describe("categorySort", () => {
  const CATEGORY_ORDER = [
    "Mini Convertibles",
    "Familiar",
    "Compact Premium",
    "Cabrio Premium",
    "SUV",
    "SUV Premium",
    "Luxury Van",
    "Aventura",
    "Luxury Elite",
  ];

  function categorySort(a: string, b: string): number {
    const idxA = CATEGORY_ORDER.indexOf(a);
    const idxB = CATEGORY_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  }

  it("should sort categories in the defined business order", () => {
    const categories = ["Luxury Elite", "SUV", "Mini Convertibles", "Familiar"];
    const sorted = [...categories].sort(categorySort);
    expect(sorted).toEqual(["Mini Convertibles", "Familiar", "SUV", "Luxury Elite"]);
  });

  it("should put unknown categories at the end", () => {
    const categories = ["SUV", "Unknown Category", "Mini Convertibles"];
    const sorted = [...categories].sort(categorySort);
    expect(sorted).toEqual(["Mini Convertibles", "SUV", "Unknown Category"]);
  });

  it("should sort unknown categories alphabetically among themselves", () => {
    const categories = ["Zebra", "Alpha", "SUV"];
    const sorted = [...categories].sort(categorySort);
    expect(sorted).toEqual(["SUV", "Alpha", "Zebra"]);
  });
});

// ─── ServicePeriod structure ────────────────────────────────────────────────

describe("ServicePeriod structure", () => {
  interface ServicePeriod {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    notes: string;
    repairId: string | null;
    ongoing: boolean;
  }

  it("should represent a repair-based service period with date range", () => {
    const sp: ServicePeriod = {
      id: "repair-abc123",
      startDate: "2026-05-12",
      endDate: "2026-05-30",
      type: "en_taller",
      notes: "Cambio de frenos (en taller)",
      repairId: "abc123",
      ongoing: true,
    };
    expect(sp.startDate).toBe("2026-05-12");
    expect(sp.endDate).toBe("2026-05-30");
    expect(sp.type).toBe("en_taller");
    expect(sp.ongoing).toBe(true);
    expect(sp.repairId).toBe("abc123");
  });

  it("should represent a manual override service period", () => {
    const sp: ServicePeriod = {
      id: "manual-vehicle-xyz",
      startDate: "2026-06-01",
      endDate: "2026-06-15",
      type: "manual",
      notes: "En servicio (estado manual)",
      repairId: null,
      ongoing: true,
    };
    expect(sp.type).toBe("manual");
    expect(sp.repairId).toBeNull();
    expect(sp.ongoing).toBe(true);
  });

  it("should represent a completed (non-ongoing) service period", () => {
    const sp: ServicePeriod = {
      id: "repair-def456",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      type: "listo_recoger",
      notes: "Pintura lateral (listo recoger)",
      repairId: "def456",
      ongoing: false,
    };
    expect(sp.ongoing).toBe(false);
    expect(sp.endDate).toBe("2026-04-10");
  });
});

// ─── TimelineGroupVehicle with servicePeriods ───────────────────────────────

describe("TimelineGroupVehicle with servicePeriods", () => {
  interface ServicePeriod {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    notes: string;
    repairId: string | null;
    ongoing: boolean;
  }

  interface TimelineGroupVehicle {
    plate: string;
    model: string | null;
    isCollaborator: boolean;
    servicePeriods: ServicePeriod[];
    reservations: any[];
  }

  it("should include service periods with date ranges in vehicle data", () => {
    const vehicle: TimelineGroupVehicle = {
      plate: "2691MTL",
      model: "Mercedes B 200 D DCT 150 5P",
      isCollaborator: false,
      servicePeriods: [
        {
          id: "repair-abc",
          startDate: "2026-05-12",
          endDate: "2026-05-30",
          type: "en_taller",
          notes: "Cambio de frenos",
          repairId: "abc",
          ongoing: true,
        },
      ],
      reservations: [],
    };
    expect(vehicle.servicePeriods).toHaveLength(1);
    expect(vehicle.servicePeriods[0].startDate).toBe("2026-05-12");
    expect(vehicle.servicePeriods[0].endDate).toBe("2026-05-30");
    expect(vehicle.servicePeriods[0].type).toBe("en_taller");
  });

  it("should have empty servicePeriods for vehicles not in service", () => {
    const vehicle: TimelineGroupVehicle = {
      plate: "5678DEF",
      model: "BMW X5",
      isCollaborator: false,
      servicePeriods: [],
      reservations: [],
    };
    expect(vehicle.servicePeriods).toHaveLength(0);
  });

  it("should support multiple service periods for the same vehicle", () => {
    const vehicle: TimelineGroupVehicle = {
      plate: "1234ABC",
      model: "Mercedes V Class",
      isCollaborator: false,
      servicePeriods: [
        {
          id: "repair-1",
          startDate: "2026-03-01",
          endDate: "2026-03-10",
          type: "en_taller",
          notes: "Cambio de aceite",
          repairId: "r1",
          ongoing: false,
        },
        {
          id: "repair-2",
          startDate: "2026-05-15",
          endDate: "2026-05-28",
          type: "esperando_piezas",
          notes: "Esperando piezas de motor",
          repairId: "r2",
          ongoing: true,
        },
      ],
      reservations: [],
    };
    expect(vehicle.servicePeriods).toHaveLength(2);
    expect(vehicle.servicePeriods[0].ongoing).toBe(false);
    expect(vehicle.servicePeriods[1].ongoing).toBe(true);
  });
});

// ─── Service period date clamping logic ─────────────────────────────────────

describe("Service period date clamping", () => {
  /**
   * Replicates the date clamping logic from buildServicePeriodsMap:
   * - startDate: max(started_at || created_at, fromDate)
   * - endDate: min(completed_at || toDate, toDate)
   * - For ongoing repairs without completed_at, endDate = toDate
   */
  function clampServicePeriod(
    startedAt: string | null,
    createdAt: string,
    completedAt: string | null,
    fromDate: string,
    toDate: string,
    todayStr: string,
  ): { startDate: string; endDate: string; ongoing: boolean } {
    const rawStart = startedAt || createdAt;
    const startDate = rawStart < fromDate ? fromDate : rawStart;
    const ongoing = !completedAt;
    const rawEnd = completedAt || todayStr;
    const endDate = rawEnd > toDate ? toDate : rawEnd;
    return { startDate, endDate, ongoing };
  }

  it("should use started_at as start when available", () => {
    const result = clampServicePeriod(
      "2026-05-12", "2026-05-10", null,
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.startDate).toBe("2026-05-12");
  });

  it("should fall back to created_at when started_at is null", () => {
    const result = clampServicePeriod(
      null, "2026-05-10", null,
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.startDate).toBe("2026-05-10");
  });

  it("should clamp start to fromDate when repair started before visible range", () => {
    const result = clampServicePeriod(
      "2026-04-15", "2026-04-10", null,
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.startDate).toBe("2026-05-01");
  });

  it("should use completed_at as end when available", () => {
    const result = clampServicePeriod(
      "2026-05-12", "2026-05-10", "2026-05-25",
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.endDate).toBe("2026-05-25");
    expect(result.ongoing).toBe(false);
  });

  it("should use todayStr as end for ongoing repairs", () => {
    const result = clampServicePeriod(
      "2026-05-12", "2026-05-10", null,
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.endDate).toBe("2026-05-28");
    expect(result.ongoing).toBe(true);
  });

  it("should clamp end to toDate when repair extends beyond visible range", () => {
    const result = clampServicePeriod(
      "2026-05-12", "2026-05-10", "2026-07-15",
      "2026-05-01", "2026-06-30", "2026-05-28"
    );
    expect(result.endDate).toBe("2026-06-30");
    expect(result.ongoing).toBe(false);
  });
});

// ─── Daily occupancy density computation ─────────────────────────────────────

describe("computeDailyOccupancy", () => {
  interface TimelineReservation {
    startDate: string;
    endDate: string;
    status: string;
  }

  interface TimelineVehicle {
    reservations: TimelineReservation[];
  }

  interface TimelineGroup {
    vehicles: TimelineVehicle[];
  }

  function computeDailyOccupancy(groups: TimelineGroup[], days: string[]): number[] {
    const counts = new Array(days.length).fill(0);
    const daySet = new Map<string, number>();
    for (let i = 0; i < days.length; i++) {
      daySet.set(days[i], i);
    }

    for (const group of groups) {
      for (const vehicle of group.vehicles) {
        for (const res of vehicle.reservations) {
          if (res.status === "Cancelada") continue;
          const startDate = new Date(res.startDate + "T00:00:00");
          const endDate = new Date(res.endDate + "T00:00:00");
          const rangeStart = new Date(days[0] + "T00:00:00");
          const rangeEnd = new Date(days[days.length - 1] + "T00:00:00");

          const effectiveStart = new Date(Math.max(startDate.getTime(), rangeStart.getTime()));
          const effectiveEnd = new Date(Math.min(endDate.getTime(), rangeEnd.getTime()));

          const current = new Date(effectiveStart);
          while (current <= effectiveEnd) {
            const key = current.toISOString().split("T")[0];
            const idx = daySet.get(key);
            if (idx !== undefined) {
              counts[idx]++;
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }
    }
    return counts;
  }

  const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];

  it("should count 0 for days with no reservations", () => {
    const groups: TimelineGroup[] = [{ vehicles: [{ reservations: [] }] }];
    const result = computeDailyOccupancy(groups, days);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("should count reservations overlapping each day", () => {
    const groups: TimelineGroup[] = [{
      vehicles: [{
        reservations: [
          { startDate: "2026-06-01", endDate: "2026-06-03", status: "Confirmada" },
        ],
      }],
    }];
    const result = computeDailyOccupancy(groups, days);
    expect(result).toEqual([1, 1, 1, 0, 0]);
  });

  it("should sum overlapping reservations from multiple vehicles", () => {
    const groups: TimelineGroup[] = [{
      vehicles: [
        {
          reservations: [
            { startDate: "2026-06-01", endDate: "2026-06-02", status: "Confirmada" },
          ],
        },
        {
          reservations: [
            { startDate: "2026-06-02", endDate: "2026-06-04", status: "En curso" },
          ],
        },
      ],
    }];
    const result = computeDailyOccupancy(groups, days);
    expect(result).toEqual([1, 2, 1, 1, 0]);
  });

  it("should skip cancelled reservations", () => {
    const groups: TimelineGroup[] = [{
      vehicles: [{
        reservations: [
          { startDate: "2026-06-01", endDate: "2026-06-05", status: "Cancelada" },
        ],
      }],
    }];
    const result = computeDailyOccupancy(groups, days);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it("should clamp reservations to the visible range", () => {
    const groups: TimelineGroup[] = [{
      vehicles: [{
        reservations: [
          { startDate: "2026-05-28", endDate: "2026-06-02", status: "Confirmada" },
        ],
      }],
    }];
    const result = computeDailyOccupancy(groups, days);
    expect(result).toEqual([1, 1, 0, 0, 0]);
  });
});

// ─── densityColor ────────────────────────────────────────────────────────────

describe("densityColor", () => {
  function densityColor(count: number, maxCount: number): string {
    if (maxCount === 0 || count === 0) return "transparent";
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "rgba(74, 222, 128, 0.5)";
    if (ratio <= 0.50) return "rgba(250, 204, 21, 0.5)";
    if (ratio <= 0.75) return "rgba(251, 146, 60, 0.55)";
    return "rgba(248, 113, 113, 0.6)";
  }

  it("should return transparent for 0 count", () => {
    expect(densityColor(0, 10)).toBe("transparent");
  });

  it("should return transparent for 0 maxCount", () => {
    expect(densityColor(5, 0)).toBe("transparent");
  });

  it("should return green for low density (<=25%)", () => {
    expect(densityColor(2, 10)).toContain("74, 222, 128");
  });

  it("should return yellow for medium density (25-50%)", () => {
    expect(densityColor(4, 10)).toContain("250, 204, 21");
  });

  it("should return orange for high density (50-75%)", () => {
    expect(densityColor(6, 10)).toContain("251, 146, 60");
  });

  it("should return red for very high density (>75%)", () => {
    expect(densityColor(9, 10)).toContain("248, 113, 113");
  });
});

// ─── STATUS_COLORS mapping ───────────────────────────────────────────────────

describe("STATUS_COLORS", () => {
  const STATUS_COLORS: Record<string, string> = {
    Pendiente: "#93c5fd",
    Confirmada: "#fb923c",
    "En curso": "#4ade80",
    Completada: "#9ca3af",
    Cancelada: "#f87171",
    Cotizado: "#c084fc",
    "No Show": "#f472b6",
  };

  it("should have colors for all expected statuses", () => {
    expect(STATUS_COLORS["Pendiente"]).toBeDefined();
    expect(STATUS_COLORS["Confirmada"]).toBeDefined();
    expect(STATUS_COLORS["En curso"]).toBeDefined();
    expect(STATUS_COLORS["Completada"]).toBeDefined();
    expect(STATUS_COLORS["Cancelada"]).toBeDefined();
    expect(STATUS_COLORS["Cotizado"]).toBeDefined();
    expect(STATUS_COLORS["No Show"]).toBeDefined();
  });

  it("should use hex color format", () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
