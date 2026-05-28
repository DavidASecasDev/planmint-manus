import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the repair-service-sync endpoint.
 * Tests the logic of determining sync actions and building payloads.
 */

// ─── Test the determineSyncAction logic (extracted for testability) ──────────

type RepairStatus =
  | "pendiente_aprobacion"
  | "listo_entregar_taller"
  | "en_taller"
  | "esperando_piezas"
  | "listo_recoger"
  | "finalizado";

type SyncAction = "create" | "update" | "finish" | "cancel";

function determineSyncAction(
  data: { status?: RepairStatus; scheduled_date?: string | null; started_at?: string | null; completed_at?: string | null },
  previousStatus?: RepairStatus
): { action: SyncAction; shouldSync: boolean } {
  if (data.status === "en_taller" && previousStatus !== "en_taller") {
    return { action: "create", shouldSync: true };
  }
  if (data.status === "finalizado" || data.status === "listo_recoger") {
    return { action: "finish", shouldSync: true };
  }
  if (!data.status && (data.scheduled_date || data.started_at || data.completed_at)) {
    return { action: "update", shouldSync: true };
  }
  return { action: "update", shouldSync: false };
}

describe("determineSyncAction", () => {
  it("should return create when status changes to en_taller", () => {
    const result = determineSyncAction(
      { status: "en_taller" },
      "listo_entregar_taller"
    );
    expect(result).toEqual({ action: "create", shouldSync: true });
  });

  it("should NOT sync when already en_taller and staying en_taller", () => {
    const result = determineSyncAction(
      { status: "en_taller" },
      "en_taller"
    );
    expect(result).toEqual({ action: "update", shouldSync: false });
  });

  it("should return finish when status changes to finalizado", () => {
    const result = determineSyncAction(
      { status: "finalizado" },
      "en_taller"
    );
    expect(result).toEqual({ action: "finish", shouldSync: true });
  });

  it("should return finish when status changes to listo_recoger", () => {
    const result = determineSyncAction(
      { status: "listo_recoger" },
      "en_taller"
    );
    expect(result).toEqual({ action: "finish", shouldSync: true });
  });

  it("should return update when dates change without status change", () => {
    const result = determineSyncAction(
      { scheduled_date: "2026-06-15" },
      undefined
    );
    expect(result).toEqual({ action: "update", shouldSync: true });
  });

  it("should return update with shouldSync=true when started_at changes", () => {
    const result = determineSyncAction(
      { started_at: "2026-05-28T10:00:00Z" },
      undefined
    );
    expect(result).toEqual({ action: "update", shouldSync: true });
  });

  it("should NOT sync when no relevant fields change", () => {
    const result = determineSyncAction(
      { status: "pendiente_aprobacion" },
      "pendiente_aprobacion"
    );
    expect(result).toEqual({ action: "update", shouldSync: false });
  });

  it("should NOT sync when status changes to esperando_piezas (not a terminal state)", () => {
    const result = determineSyncAction(
      { status: "esperando_piezas" },
      "en_taller"
    );
    expect(result).toEqual({ action: "update", shouldSync: false });
  });
});

// ─── Test payload builders ──────────────────────────────────────────────────

function formatDateForRently(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString().replace("Z", "").split(".")[0];
  const d = new Date(dateStr);
  return d.toISOString().replace("Z", "").split(".")[0];
}

function buildCreateServicePayload(repair: any, plate: string) {
  const fromDate = formatDateForRently(repair.started_at || repair.created_at);
  let toDate: string;
  if (repair.scheduled_date) {
    toDate = formatDateForRently(repair.scheduled_date);
  } else {
    const from = new Date(repair.started_at || repair.created_at || Date.now());
    from.setDate(from.getDate() + 30);
    toDate = from.toISOString().replace("Z", "").split(".")[0];
  }

  const notes = [
    repair.description || "",
    repair.notes || "",
    `[PlanMint Garatech - Reparación #${repair.id}]`,
  ].filter(Boolean).join(" | ");

  return {
    CarId: plate,
    ServiceTypeId: 11,
    FromDate: fromDate,
    ToDate: toDate,
    Status: 1,
    Notes: notes.substring(0, 500),
    Km: repair.km_at_repair || 0,
    Price: 0,
    IsFixed: false,
    IsLockedForEdit: false,
  };
}

describe("buildCreateServicePayload", () => {
  it("should build correct payload with all fields", () => {
    const repair = {
      id: "abc-123",
      started_at: "2026-05-20T10:00:00Z",
      scheduled_date: "2026-06-15T10:00:00Z",
      description: "Cambio de pastillas de freno",
      notes: "Urgente",
      km_at_repair: 45000,
      created_at: "2026-05-18T08:00:00Z",
    };

    const payload = buildCreateServicePayload(repair, "2691MTL");

    expect(payload.CarId).toBe("2691MTL");
    expect(payload.ServiceTypeId).toBe(11);
    expect(payload.Status).toBe(1); // EN_EJECUCION
    expect(payload.FromDate).toContain("2026-05-20");
    expect(payload.ToDate).toContain("2026-06-15");
    expect(payload.Notes).toContain("Cambio de pastillas de freno");
    expect(payload.Notes).toContain("Urgente");
    expect(payload.Notes).toContain("[PlanMint Garatech - Reparación #abc-123]");
    expect(payload.Km).toBe(45000);
    expect(payload.Price).toBe(0);
    expect(payload.IsFixed).toBe(false);
    expect(payload.IsLockedForEdit).toBe(false);
  });

  it("should use created_at as fallback for FromDate when started_at is missing", () => {
    const repair = {
      id: "xyz-456",
      started_at: null,
      scheduled_date: null,
      description: "Revisión general",
      notes: "",
      km_at_repair: null,
      created_at: "2026-05-15T09:00:00Z",
    };

    const payload = buildCreateServicePayload(repair, "9881MRK");

    expect(payload.CarId).toBe("9881MRK");
    expect(payload.FromDate).toContain("2026-05-15");
    // ToDate should be +30 days from created_at
    expect(payload.ToDate).toContain("2026-06-14");
    expect(payload.Km).toBe(0);
  });

  it("should truncate notes to 500 characters", () => {
    const longDescription = "A".repeat(600);
    const repair = {
      id: "long-1",
      started_at: "2026-05-20T10:00:00Z",
      scheduled_date: "2026-06-15T10:00:00Z",
      description: longDescription,
      notes: "",
      km_at_repair: 0,
      created_at: "2026-05-18T08:00:00Z",
    };

    const payload = buildCreateServicePayload(repair, "1234ABC");
    expect(payload.Notes.length).toBeLessThanOrEqual(500);
  });
});

// ─── Test formatDateForRently ───────────────────────────────────────────────

describe("formatDateForRently", () => {
  it("should format a valid ISO date string without timezone suffix", () => {
    const result = formatDateForRently("2026-05-28T10:30:00Z");
    expect(result).toBe("2026-05-28T10:30:00");
    expect(result).not.toContain("Z");
    expect(result).not.toContain("+");
  });

  it("should handle date-only strings", () => {
    const result = formatDateForRently("2026-06-15T00:00:00.000Z");
    expect(result).toContain("2026-06-15");
    expect(result).not.toContain("Z");
  });

  it("should return current time when null is passed", () => {
    const result = formatDateForRently(null);
    expect(result).not.toContain("Z");
    // Should be a valid date format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

// ─── Test Rently status constants ───────────────────────────────────────────

describe("Rently service status mapping", () => {
  const RENTLY_STATUS = {
    PROGRAMADO: 0,
    EN_EJECUCION: 1,
    FINALIZADO: 2,
    CANCELADO: 3,
  };

  it("should have correct numeric values for each status", () => {
    expect(RENTLY_STATUS.PROGRAMADO).toBe(0);
    expect(RENTLY_STATUS.EN_EJECUCION).toBe(1);
    expect(RENTLY_STATUS.FINALIZADO).toBe(2);
    expect(RENTLY_STATUS.CANCELADO).toBe(3);
  });
});
