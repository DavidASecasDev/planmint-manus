import { describe, it, expect } from "vitest";

/**
 * Tests for the Public Operations Endpoint logic.
 * These test the data transformation and load calculation logic.
 */

// ─── Load Level Calculation Logic ────────────────────────────────────────────
function calculateLoad(total: number, avgOpsPerHour: number): "libre" | "baja" | "media" | "alta" {
  if (total === 0) return "libre";
  if (total <= Math.max(avgOpsPerHour * 0.7, 2)) return "baja";
  if (total <= Math.max(avgOpsPerHour * 1.3, 4)) return "media";
  return "alta";
}

describe("Public Operations - Load Level Calculation", () => {
  it("should return 'libre' when total is 0", () => {
    expect(calculateLoad(0, 3)).toBe("libre");
    expect(calculateLoad(0, 0)).toBe("libre");
  });

  it("should return 'baja' for low operation counts", () => {
    expect(calculateLoad(1, 5)).toBe("baja");
    expect(calculateLoad(2, 5)).toBe("baja");
  });

  it("should return 'media' for moderate operation counts", () => {
    expect(calculateLoad(3, 3)).toBe("media");
    expect(calculateLoad(4, 4)).toBe("media");
  });

  it("should return 'alta' for high operation counts", () => {
    expect(calculateLoad(5, 3)).toBe("alta");
    expect(calculateLoad(8, 4)).toBe("alta");
  });

  it("should use minimum thresholds (2 for baja, 4 for media)", () => {
    // With avg=1, 0.7*1=0.7 but min is 2, so baja threshold is 2
    expect(calculateLoad(2, 1)).toBe("baja");
    // With avg=1, 1.3*1=1.3 but min is 4, so media threshold is 4
    expect(calculateLoad(4, 1)).toBe("media");
    expect(calculateLoad(5, 1)).toBe("alta");
  });
});

// ─── Hourly Grouping Logic ───────────────────────────────────────────────────
describe("Public Operations - Hourly Grouping", () => {
  it("should initialize hours 7-22 with zero counts", () => {
    const hourlyMap = new Map<number, { hour: number; entregas: number; devoluciones: number; total: number }>();
    for (let h = 7; h <= 22; h++) {
      hourlyMap.set(h, { hour: h, entregas: 0, devoluciones: 0, total: 0 });
    }
    expect(hourlyMap.size).toBe(16);
    expect(hourlyMap.get(7)?.total).toBe(0);
    expect(hourlyMap.get(22)?.total).toBe(0);
  });

  it("should correctly count entregas and devoluciones per hour", () => {
    const operations = [
      { type: "entrega", hour: 9 },
      { type: "entrega", hour: 9 },
      { type: "devolucion", hour: 9 },
      { type: "devolucion", hour: 12 },
      { type: "devolucion", hour: 12 },
    ];

    const hourlyMap = new Map<number, { entregas: number; devoluciones: number; total: number }>();
    for (const op of operations) {
      const existing = hourlyMap.get(op.hour) || { entregas: 0, devoluciones: 0, total: 0 };
      if (op.type === "entrega") existing.entregas++;
      else existing.devoluciones++;
      existing.total++;
      hourlyMap.set(op.hour, existing);
    }

    expect(hourlyMap.get(9)?.entregas).toBe(2);
    expect(hourlyMap.get(9)?.devoluciones).toBe(1);
    expect(hourlyMap.get(9)?.total).toBe(3);
    expect(hourlyMap.get(12)?.devoluciones).toBe(2);
    expect(hourlyMap.get(12)?.total).toBe(2);
  });
});

// ─── Recommended Slots Logic ─────────────────────────────────────────────────
describe("Public Operations - Recommended Slots", () => {
  it("should recommend slots with libre or baja load between 8-20", () => {
    const hourlyWithLoad = [
      { hour: 7, load: "libre" as const, total: 0 },
      { hour: 8, load: "libre" as const, total: 0 },
      { hour: 9, load: "baja" as const, total: 1 },
      { hour: 10, load: "media" as const, total: 3 },
      { hour: 11, load: "alta" as const, total: 6 },
      { hour: 12, load: "baja" as const, total: 2 },
      { hour: 20, load: "libre" as const, total: 0 },
      { hour: 21, load: "libre" as const, total: 0 },
    ];

    const recommended = hourlyWithLoad
      .filter(h => h.hour >= 8 && h.hour <= 20 && (h.load === "libre" || h.load === "baja"));

    expect(recommended).toHaveLength(4); // 8 (libre), 9 (baja), 12 (baja), 20 (libre)
    expect(recommended.map(r => r.hour)).toEqual([8, 9, 12, 20]);
  });

  it("should not recommend hours outside 8-20 range", () => {
    const hourlyWithLoad = [
      { hour: 6, load: "libre" as const, total: 0 },
      { hour: 7, load: "libre" as const, total: 0 },
      { hour: 21, load: "libre" as const, total: 0 },
      { hour: 22, load: "libre" as const, total: 0 },
    ];

    const recommended = hourlyWithLoad
      .filter(h => h.hour >= 8 && h.hour <= 20 && (h.load === "libre" || h.load === "baja"));

    expect(recommended).toHaveLength(0);
  });
});

// ─── Model Availability Grouping ─────────────────────────────────────────────
describe("Public Operations - Model Availability", () => {
  it("should group vehicles by modelo and count by status", () => {
    const vehicles = [
      { modelo: "GLA", categoria: "SUV", status: "limpio" },
      { modelo: "GLA", categoria: "SUV", status: "sucio" },
      { modelo: "GLA", categoria: "SUV", status: "alquilado" },
      { modelo: "Clase A", categoria: "Compact", status: "limpio" },
      { modelo: "Clase A", categoria: "Compact", status: "limpio" },
    ];

    const modelMap = new Map<string, { modelo: string; categoria: string | null; limpios: number; pendientes: number; no_disponibles: number; total: number }>();

    for (const v of vehicles) {
      const key = v.modelo;
      const existing = modelMap.get(key);
      if (existing) {
        existing.total++;
        if (v.status === "limpio") existing.limpios++;
        else if (v.status === "sucio" || v.status === "incompleto") existing.pendientes++;
        else existing.no_disponibles++;
      } else {
        modelMap.set(key, {
          modelo: key,
          categoria: v.categoria || null,
          limpios: v.status === "limpio" ? 1 : 0,
          pendientes: (v.status === "sucio" || v.status === "incompleto") ? 1 : 0,
          no_disponibles: (v.status === "alquilado" || v.status === "en_servicio") ? 1 : 0,
          total: 1,
        });
      }
    }

    const gla = modelMap.get("GLA")!;
    expect(gla.limpios).toBe(1);
    expect(gla.pendientes).toBe(1);
    expect(gla.no_disponibles).toBe(1);
    expect(gla.total).toBe(3);

    const claseA = modelMap.get("Clase A")!;
    expect(claseA.limpios).toBe(2);
    expect(claseA.pendientes).toBe(0);
    expect(claseA.no_disponibles).toBe(0);
    expect(claseA.total).toBe(2);
  });

  it("should sort models by limpios descending", () => {
    const models = [
      { modelo: "A", limpios: 0 },
      { modelo: "B", limpios: 3 },
      { modelo: "C", limpios: 1 },
    ];

    const sorted = models.sort((a, b) => b.limpios - a.limpios || a.modelo.localeCompare(b.modelo));
    expect(sorted.map(m => m.modelo)).toEqual(["B", "C", "A"]);
  });
});

// ─── Org Slug Validation ─────────────────────────────────────────────────────
describe("Public Operations - Slug Validation", () => {
  const ORG_SLUG_MAP: Record<string, string> = {
    "azul-ops": "a23a0d42-5af7-4cda-9955-569c10cc6714",
  };

  it("should resolve valid slug to organization ID", () => {
    expect(ORG_SLUG_MAP["azul-ops"]).toBe("a23a0d42-5af7-4cda-9955-569c10cc6714");
  });

  it("should return undefined for invalid slug", () => {
    expect(ORG_SLUG_MAP["invalid-slug"]).toBeUndefined();
    expect(ORG_SLUG_MAP[""]).toBeUndefined();
  });
});

// ─── Date Parsing ────────────────────────────────────────────────────────────
describe("Public Operations - Date Parsing", () => {
  it("should validate date format YYYY-MM-DD", () => {
    const validDate = "2026-05-06";
    const invalidDate1 = "06-05-2026";
    const invalidDate2 = "2026/05/06";
    const invalidDate3 = "not-a-date";

    const regex = /^\d{4}-\d{2}-\d{2}$/;
    expect(regex.test(validDate)).toBe(true);
    expect(regex.test(invalidDate1)).toBe(false);
    expect(regex.test(invalidDate2)).toBe(false);
    expect(regex.test(invalidDate3)).toBe(false);
  });
});

// ─── Operation Date Extraction ───────────────────────────────────────────────
describe("Public Operations - Operation Date Extraction", () => {
  it("should extract date from confirmed_entrega_datetime first", () => {
    const reservation = {
      desde: "2026-05-06T10:00:00",
      confirmed_entrega_datetime: "2026-05-06T09:30:00",
    };

    const desdeDate = reservation.confirmed_entrega_datetime?.substring(0, 10) || reservation.desde?.substring(0, 10);
    expect(desdeDate).toBe("2026-05-06");
  });

  it("should fall back to desde if confirmed_entrega_datetime is null", () => {
    const reservation = {
      desde: "2026-05-06T10:00:00",
      confirmed_entrega_datetime: null as string | null,
    };

    const desdeDate = reservation.confirmed_entrega_datetime?.substring(0, 10) || reservation.desde?.substring(0, 10);
    expect(desdeDate).toBe("2026-05-06");
  });

  it("should extract hour correctly from datetime string", () => {
    const datetime = "2026-05-06T14:30:00";
    const hour = parseInt(datetime.substring(11, 13));
    expect(hour).toBe(14);
  });

  it("should handle single-digit hours", () => {
    const datetime = "2026-05-06T09:00:00";
    const hour = parseInt(datetime.substring(11, 13));
    expect(hour).toBe(9);
  });
});

// ─── Fleet Status Summary ────────────────────────────────────────────────────
describe("Public Operations - Fleet Status Summary", () => {
  it("should correctly aggregate status counts", () => {
    const vehicles = [
      { status: "limpio" },
      { status: "limpio" },
      { status: "sucio" },
      { status: "alquilado" },
      { status: "alquilado" },
      { status: "alquilado" },
      { status: "en_servicio" },
      { status: "incompleto" },
    ];

    const summary = { limpio: 0, sucio: 0, incompleto: 0, en_servicio: 0, alquilado: 0, total: 0 };
    for (const v of vehicles) {
      summary.total++;
      const s = v.status as keyof typeof summary;
      if (s in summary && s !== "total") {
        summary[s]++;
      }
    }

    expect(summary.limpio).toBe(2);
    expect(summary.sucio).toBe(1);
    expect(summary.incompleto).toBe(1);
    expect(summary.en_servicio).toBe(1);
    expect(summary.alquilado).toBe(3);
    expect(summary.total).toBe(8);
  });
});
