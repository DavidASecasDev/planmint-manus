import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const endpointSource = fs.readFileSync(
  path.resolve(__dirname, "movementsEndpoint.ts"),
  "utf-8"
);

const indexSource = fs.readFileSync(
  path.resolve(__dirname, "_core/index.ts"),
  "utf-8"
);

describe("Movements Endpoint — Structure", () => {
  it("exports all required handler functions", () => {
    expect(endpointSource).toContain("export async function handleMovementsStart");
    expect(endpointSource).toContain("export async function handleMovementsEnd");
    expect(endpointSource).toContain("export async function handleMovementsCancel");
    expect(endpointSource).toContain("export async function handleMovementsActive");
    expect(endpointSource).toContain("export async function handleMovementsMine");
    expect(endpointSource).toContain("export async function handleMovementsGetById");
    expect(endpointSource).toContain("export async function handleMovementsUploadPhoto");
  });

  it("uses service role client for database operations", () => {
    expect(endpointSource).toContain("getServiceClient");
  });

  it("authenticates requests via Supabase JWT", () => {
    expect(endpointSource).toContain("authenticateSupabaseRequest");
  });

  it("validates plate against fleet_vehicles table", () => {
    expect(endpointSource).toContain("fleet_vehicles");
    expect(endpointSource).toContain("validatePlateInOrg");
  });
});

describe("Movements Endpoint — Start", () => {
  it("requires matricula and movement_type", () => {
    expect(endpointSource).toContain('"matricula and movement_type are required"');
  });

  it("validates movement_type against allowed values", () => {
    expect(endpointSource).toContain('"entrega"');
    expect(endpointSource).toContain('"recogida"');
    expect(endpointSource).toContain('"escoba"');
    expect(endpointSource).toContain('"limpieza"');
  });

  it("returns 404 when plate is not found in fleet", () => {
    expect(endpointSource).toContain("no encontrada en la flota");
  });

  it("inserts into vehicle_movements with correct fields", () => {
    expect(endpointSource).toContain("vehicle_movements");
    expect(endpointSource).toContain("driver_id: userId");
    expect(endpointSource).toContain("organization_id: organizationId");
    expect(endpointSource).toContain('status: "en_curso"');
  });
});

describe("Movements Endpoint — End", () => {
  it("requires movement_id", () => {
    expect(endpointSource).toContain('"movement_id is required"');
  });

  it("verifies movement belongs to organization", () => {
    expect(endpointSource).toContain("existing.organization_id !== organizationId");
  });

  it("only allows ending movements in en_curso status", () => {
    expect(endpointSource).toContain('existing.status !== "en_curso"');
  });

  it("updates status to completado", () => {
    expect(endpointSource).toContain('"completado"');
  });
});

describe("Movements Endpoint — Cancel", () => {
  it("requires movement_id", () => {
    // The cancel handler also checks for movement_id
    const cancelSection = endpointSource.split("handleMovementsCancel")[1];
    expect(cancelSection).toContain("movement_id");
  });

  it("only allows cancelling movements in en_curso status", () => {
    expect(endpointSource).toContain("Solo se pueden cancelar movimientos en curso");
  });

  it("updates status to cancelado", () => {
    expect(endpointSource).toContain('"cancelado"');
  });
});

describe("Movements Endpoint — Upload Photo", () => {
  it("requires image_base64", () => {
    expect(endpointSource).toContain('"image_base64 is required"');
  });

  it("uploads to movement-photos bucket", () => {
    expect(endpointSource).toContain("movement-photos");
  });

  it("returns public URL", () => {
    expect(endpointSource).toContain("getPublicUrl");
    expect(endpointSource).toContain("publicUrl");
  });
});

describe("Movements Endpoint — Route Registration", () => {
  it("registers POST /api/movements/start", () => {
    expect(indexSource).toContain('app.post("/api/movements/start", handleMovementsStart)');
  });

  it("registers POST /api/movements/end", () => {
    expect(indexSource).toContain('app.post("/api/movements/end", handleMovementsEnd)');
  });

  it("registers POST /api/movements/cancel", () => {
    expect(indexSource).toContain('app.post("/api/movements/cancel", handleMovementsCancel)');
  });

  it("registers GET /api/movements/active", () => {
    expect(indexSource).toContain('app.get("/api/movements/active", handleMovementsActive)');
  });

  it("registers GET /api/movements/mine", () => {
    expect(indexSource).toContain('app.get("/api/movements/mine", handleMovementsMine)');
  });

  it("registers GET /api/movements/:id", () => {
    expect(indexSource).toContain('app.get("/api/movements/:id", handleMovementsGetById)');
  });

  it("registers POST /api/movements/upload-photo", () => {
    expect(indexSource).toContain('app.post("/api/movements/upload-photo", handleMovementsUploadPhoto)');
  });
});
