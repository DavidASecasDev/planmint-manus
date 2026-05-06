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

// ─── Operations Table Data Transformation ───────────────────────────────────
describe("Public Operations - Operations Table", () => {
  it("should produce OperationRow with all required fields", () => {
    const reservation = {
      id: "r1",
      desde: "2026-05-06T10:30:00",
      hasta: "2026-05-08T15:00:00",
      confirmed_entrega_datetime: "2026-05-06T10:30:00",
      confirmed_devolucion_datetime: "2026-05-08T15:00:00",
      lugar_entrega: "Aeropuerto de Palma",
      lugar_devolucion: "Oficina Azul Cars",
      auto: "7137NCM",
      modelo: "GLA",
      entrega_completada: true,
      devolucion_completada: false,
    };

    const targetDate = "2026-05-06";
    const operations: Array<{
      type: "entrega" | "devolucion";
      time: string;
      location: string;
      modelo: string;
      auto: string;
      completed: boolean;
    }> = [];

    // Simulate entrega extraction
    const desdeDate = reservation.confirmed_entrega_datetime?.substring(0, 10) || reservation.desde?.substring(0, 10);
    if (desdeDate === targetDate) {
      const desdeTime = reservation.confirmed_entrega_datetime || reservation.desde;
      const hour = desdeTime ? parseInt(desdeTime.substring(11, 13)) || 0 : 0;
      const minutes = desdeTime ? parseInt(desdeTime.substring(14, 16)) || 0 : 0;
      operations.push({
        type: "entrega",
        time: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        location: reservation.lugar_entrega || "Sin ubicación",
        modelo: reservation.modelo || "Desconocido",
        auto: reservation.auto || "",
        completed: reservation.entrega_completada || false,
      });
    }

    expect(operations).toHaveLength(1);
    expect(operations[0]).toEqual({
      type: "entrega",
      time: "10:30",
      location: "Aeropuerto de Palma",
      modelo: "GLA",
      auto: "7137NCM",
      completed: true,
    });
  });

  it("should produce both entrega and devolucion for same-day reservation", () => {
    const reservation = {
      desde: "2026-05-06T09:00:00",
      hasta: "2026-05-06T18:00:00",
      confirmed_entrega_datetime: "2026-05-06T09:00:00",
      confirmed_devolucion_datetime: "2026-05-06T18:00:00",
      lugar_entrega: "Aeropuerto",
      lugar_devolucion: "Oficina",
      auto: "1234ABC",
      modelo: "Clase A",
      entrega_completada: true,
      devolucion_completada: false,
    };

    const targetDate = "2026-05-06";
    const operations: Array<{
      type: "entrega" | "devolucion";
      time: string;
      location: string;
      modelo: string;
      auto: string;
      completed: boolean;
    }> = [];

    const desdeDate = reservation.confirmed_entrega_datetime?.substring(0, 10);
    if (desdeDate === targetDate) {
      const desdeTime = reservation.confirmed_entrega_datetime;
      const hour = parseInt(desdeTime!.substring(11, 13));
      const minutes = parseInt(desdeTime!.substring(14, 16));
      operations.push({
        type: "entrega",
        time: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        location: reservation.lugar_entrega,
        modelo: reservation.modelo,
        auto: reservation.auto,
        completed: reservation.entrega_completada,
      });
    }

    const hastaDate = reservation.confirmed_devolucion_datetime?.substring(0, 10);
    if (hastaDate === targetDate) {
      const hastaTime = reservation.confirmed_devolucion_datetime;
      const hour = parseInt(hastaTime!.substring(11, 13));
      const minutes = parseInt(hastaTime!.substring(14, 16));
      operations.push({
        type: "devolucion",
        time: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        location: reservation.lugar_devolucion,
        modelo: reservation.modelo,
        auto: reservation.auto,
        completed: reservation.devolucion_completada,
      });
    }

    expect(operations).toHaveLength(2);
    expect(operations[0].type).toBe("entrega");
    expect(operations[0].time).toBe("09:00");
    expect(operations[0].completed).toBe(true);
    expect(operations[1].type).toBe("devolucion");
    expect(operations[1].time).toBe("18:00");
    expect(operations[1].completed).toBe(false);
  });

  it("should sort operations by time ascending", () => {
    const operations = [
      { type: "devolucion" as const, hour: 15, hourMinute: "15:00", location: "A", modelo: "X", auto: "1", completed: false },
      { type: "entrega" as const, hour: 9, hourMinute: "09:30", location: "B", modelo: "Y", auto: "2", completed: true },
      { type: "devolucion" as const, hour: 9, hourMinute: "09:00", location: "C", modelo: "Z", auto: "3", completed: true },
      { type: "entrega" as const, hour: 12, hourMinute: "12:45", location: "D", modelo: "W", auto: "4", completed: false },
    ];

    const sorted = [...operations].sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.hourMinute.localeCompare(b.hourMinute);
    });

    expect(sorted.map(o => o.hourMinute)).toEqual(["09:00", "09:30", "12:45", "15:00"]);
  });

  it("should handle missing location gracefully", () => {
    const reservation = {
      desde: "2026-05-06T10:00:00",
      confirmed_entrega_datetime: null as string | null,
      lugar_entrega: null as string | null,
      auto: "5555XYZ",
      modelo: "GLC",
      entrega_completada: false,
    };

    const targetDate = "2026-05-06";
    const desdeDate = reservation.confirmed_entrega_datetime?.substring(0, 10) || reservation.desde?.substring(0, 10);
    
    if (desdeDate === targetDate) {
      const desdeTime = reservation.confirmed_entrega_datetime || reservation.desde;
      const hour = desdeTime ? parseInt(desdeTime.substring(11, 13)) || 0 : 0;
      const minutes = desdeTime ? parseInt(desdeTime.substring(14, 16)) || 0 : 0;
      const op = {
        type: "entrega" as const,
        time: `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
        location: reservation.lugar_entrega || "Sin ubicación",
        modelo: reservation.modelo || "Desconocido",
        auto: reservation.auto || "",
        completed: reservation.entrega_completada || false,
      };

      expect(op.location).toBe("Sin ubicación");
      expect(op.time).toBe("10:00");
      expect(op.auto).toBe("5555XYZ");
    }
  });

  it("should handle missing modelo gracefully", () => {
    const modelo: string | null = null;
    const result = modelo || "Desconocido";
    expect(result).toBe("Desconocido");
  });

  it("should handle missing auto gracefully", () => {
    const auto: string | null = null;
    const result = auto || "";
    expect(result).toBe("");
  });

  it("should correctly count completed vs pending operations", () => {
    const operations = [
      { type: "entrega" as const, completed: true },
      { type: "entrega" as const, completed: true },
      { type: "devolucion" as const, completed: false },
      { type: "devolucion" as const, completed: true },
      { type: "entrega" as const, completed: false },
    ];

    const summary = {
      totalOperations: operations.length,
      totalEntregas: operations.filter(o => o.type === "entrega").length,
      totalDevoluciones: operations.filter(o => o.type === "devolucion").length,
      completedOps: operations.filter(o => o.completed).length,
      pendingOps: operations.filter(o => !o.completed).length,
    };

    expect(summary.totalOperations).toBe(5);
    expect(summary.totalEntregas).toBe(3);
    expect(summary.totalDevoluciones).toBe(2);
    expect(summary.completedOps).toBe(3);
    expect(summary.pendingOps).toBe(2);
  });

  it("should filter operations by location", () => {
    const operations = [
      { type: "entrega" as const, location: "Aeropuerto de Palma", auto: "1" },
      { type: "devolucion" as const, location: "Oficina Azul Cars", auto: "2" },
      { type: "entrega" as const, location: "Aeropuerto de Palma", auto: "3" },
      { type: "devolucion" as const, location: "Terminal de cruceros", auto: "4" },
    ];

    const locationFilter = "Aeropuerto";
    const filtered = operations.filter(op =>
      !locationFilter || locationFilter === "all" || op.location.toLowerCase().includes(locationFilter.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.every(op => op.location.includes("Aeropuerto"))).toBe(true);
  });

  it("should not filter when location is 'all'", () => {
    const operations = [
      { type: "entrega" as const, location: "Aeropuerto de Palma", auto: "1" },
      { type: "devolucion" as const, location: "Oficina Azul Cars", auto: "2" },
    ];

    const locationFilter = "all";
    const filtered = operations.filter(op =>
      !locationFilter || locationFilter === "all" || op.location.toLowerCase().includes(locationFilter.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
  });
});

// ─── Saturated Slots Detection ──────────────────────────────────────────────
describe("Public Operations - Saturated Slots", () => {
  it("should detect saturated slots (alta load)", () => {
    const hourlyWithLoad = [
      { hour: 8, load: "libre" as const, total: 0, entregas: 0, devoluciones: 0 },
      { hour: 9, load: "alta" as const, total: 6, entregas: 3, devoluciones: 3 },
      { hour: 10, load: "media" as const, total: 3, entregas: 1, devoluciones: 2 },
      { hour: 11, load: "alta" as const, total: 5, entregas: 2, devoluciones: 3 },
    ];

    const saturatedSlots = hourlyWithLoad
      .filter(h => h.load === "alta")
      .map(h => ({ hour: h.hour, total: h.total, entregas: h.entregas, devoluciones: h.devoluciones }));

    expect(saturatedSlots).toHaveLength(2);
    expect(saturatedSlots[0].hour).toBe(9);
    expect(saturatedSlots[0].total).toBe(6);
    expect(saturatedSlots[1].hour).toBe(11);
  });

  it("should return empty array when no slots are saturated", () => {
    const hourlyWithLoad = [
      { hour: 8, load: "libre" as const, total: 0, entregas: 0, devoluciones: 0 },
      { hour: 9, load: "baja" as const, total: 1, entregas: 1, devoluciones: 0 },
      { hour: 10, load: "media" as const, total: 3, entregas: 1, devoluciones: 2 },
    ];

    const saturatedSlots = hourlyWithLoad.filter(h => h.load === "alta");
    expect(saturatedSlots).toHaveLength(0);
  });
});
