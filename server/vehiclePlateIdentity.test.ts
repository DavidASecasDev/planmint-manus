import { describe, it, expect, vi, beforeEach } from "vitest";

// The parking side effect is irrelevant for identity and must not hit any DB.
vi.mock("./parkingEndpoints", () => ({ releaseParkingSpotByVehicle: vi.fn(async () => undefined) }));

import { normalizeVehiclePlate, resolveVehicleByPlate } from "../shared/vehiclePlate";
import { planVehicleImport, buildVehicleImportUpdate } from "../client/src/lib/vehicleImportPlan";
import { syncVehicleStatuses } from "./syncRently";

/*
 * Synthetic, in-memory only. No network, no Supabase project, no real data.
 * The fake client implements just the PostgREST builder surface used by
 * syncVehicleStatuses and enforces the same normalized partial unique index
 * that the migration installs (organization_id, normalized plate, active).
 */
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;
type Filter = (r: Row) => boolean;

function makeFakeClient(tables: Tables, opts: { failAliasRead?: boolean; beforeVehicleInsert?: (t: Tables) => void } = {}) {
  let seq = 0;
  const writes: Array<{ table: string; op: string; values: Row }> = [];
  const uniqueViolation = (t: string, r: Row) =>
    t === "vehicles" &&
    r.is_archived !== true &&
    tables.vehicles.some(
      (v) =>
        v.id !== r.id &&
        v.organization_id === r.organization_id &&
        v.is_archived !== true &&
        normalizeVehiclePlate(v.matricula) === normalizeVehiclePlate(r.matricula),
    );

  function builder(table: string) {
    const filters: Filter[] = [];
    let op: "select" | "update" | "insert" = "select";
    let payload: Row | null = null;
    let wantSingle = false;
    const api: any = {
      select() { return api; },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return api; },
      in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return api; },
      is(c: string, v: unknown) { filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return api; },
      not(c: string, o: string, v: unknown) {
        if (o === "is" && v === null) filters.push((r) => r[c] != null);
        return api;
      },
      update(values: Row) { op = "update"; payload = values; return api; },
      insert(values: Row) { op = "insert"; payload = values; return api; },
      single() { wantSingle = true; return api; },
      then(resolve: (v: any) => void, reject: (e: unknown) => void) {
        try { resolve(execute()); } catch (e) { reject(e); }
      },
    };
    function execute() {
      if (table === "vehicle_identity_aliases" && opts.failAliasRead) {
        return { data: null, error: { code: "42501", message: "permission denied" } };
      }
      const rows = (tables[table] ||= []);
      if (op === "select") {
        const data = rows.filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r }));
        return { data: wantSingle ? data[0] ?? null : data, error: null };
      }
      if (op === "update") {
        const targets = rows.filter((r) => filters.every((f) => f(r)));
        for (const r of targets) {
          const next = { ...r, ...payload };
          if (uniqueViolation(table, next)) return { data: null, error: { code: "23505" } };
        }
        targets.forEach((r) => { Object.assign(r, payload); writes.push({ table, op, values: { id: r.id, ...payload } }); });
        return { data: null, error: null };
      }
      if (table === "vehicles" && opts.beforeVehicleInsert) opts.beforeVehicleInsert(tables);
      const row = { id: `${table}-new-${++seq}`, is_archived: false, fleet_vehicle_id: null, ...payload };
      if (uniqueViolation(table, row)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      rows.push(row);
      writes.push({ table, op, values: row });
      return { data: wantSingle ? { ...row } : [{ ...row }], error: null };
    }
    return api;
  }
  return { client: { from: builder } as any, writes };
}

const ORG1 = "org-1";
const ORG2 = "org-2";
const vehicle = (o: Partial<Row>): Row => ({
  organization_id: ORG1, status: "sucio", current_reservation_id: null, is_archived: false,
  fleet_vehicle_id: "fleet-x", modelo: null, categoria: null, ...o,
});
const activeRes = (o: Partial<Row>): Row => ({ organization_id: ORG1, estado: "En curso", modelo: "GLA", categoria: "SUV", ...o });
const plateKeyCount = (t: Tables, org: string, key: string) =>
  t.vehicles.filter((v) => v.organization_id === org && normalizeVehiclePlate(v.matricula) === key).length;

describe("normalizeVehiclePlate / resolveVehicleByPlate", () => {
  it("treats case, spaces and harmless separators as the same unit", () => {
    for (const p of ["9772 NNS", "9772nns", " 9772-NNS ", "9772.nns", "9772NNS"]) {
      expect(normalizeVehiclePlate(p)).toBe("9772NNS");
    }
    expect(normalizeVehiclePlate(null)).toBe("");
  });
  it("never resolves ambiguous, alias-only or empty identities", () => {
    const a = { id: "a", matricula: "9772 NNS", is_archived: false };
    const b = { id: "b", matricula: "9772NNS", is_archived: false };
    expect(resolveVehicleByPlate("9772nns", [a])).toEqual({ kind: "active", vehicle: a });
    expect(resolveVehicleByPlate("9772NNS", [a, b]).kind).toBe("ambiguous");
    expect(resolveVehicleByPlate("9772NNS", [{ ...a, is_archived: true }], new Set(["a"]))).toMatchObject({
      kind: "ambiguous", reason: "alias_without_active_canonical",
    });
    expect(resolveVehicleByPlate("9772NNS", [{ ...a, is_archived: true }, b], new Set(["a"]))).toEqual({ kind: "active", vehicle: b });
    expect(resolveVehicleByPlate("  ", [a]).kind).toBe("ambiguous");
    expect(resolveVehicleByPlate("1111AAA", [a]).kind).toBe("none");
  });
});

describe("vehicle import planning", () => {
  const locations = new Set(["campa"]);
  it("matches an existing unit by normalized plate instead of creating a duplicate", () => {
    const plan = planVehicleImport([{ matricula: "9772nns", modelo: "GLA" }], [{ id: "a", matricula: "9772 NNS", is_archived: false }], locations);
    expect(plan[0]).toMatchObject({ status: "update", existingVehicleId: "a" });
  });
  it("repeated import of the same file only updates, never inserts again", () => {
    const existing = [{ id: "v1", matricula: "1111AAA", is_archived: false }];
    const rows = [{ matricula: "1111AAA" }, { matricula: "2222bbb" }];
    const first = planVehicleImport(rows, existing, locations);
    expect(first.map((r) => r.status)).toEqual(["update", "new"]);
    const second = planVehicleImport(rows, [...existing, { id: "v2", matricula: "2222BBB", is_archived: false }], locations);
    expect(second.map((r) => r.status)).toEqual(["update", "update"]);
  });
  it("rejects in-file duplicates, archived matches and ambiguous matches", () => {
    const plan = planVehicleImport(
      [{ matricula: "3333CCC" }, { matricula: "3333ccc" }, { matricula: "4444DDD" }, { matricula: "5555EEE" }],
      [
        { id: "arch", matricula: "4444 DDD", is_archived: true },
        { id: "e1", matricula: "5555EEE", is_archived: false },
        { id: "e2", matricula: "5555 EEE", is_archived: false },
      ],
      locations,
    );
    expect(plan.map((r) => r.status)).toEqual(["new", "error", "error", "error"]);
    expect(plan[1].errorMessage).toMatch(/repetida/);
    expect(plan[2].errorMessage).toMatch(/archivado/);
    expect(plan[3].errorMessage).toMatch(/varias fichas/);
  });
  it("updates of existing vehicles never carry status, archive flags or plate literal", () => {
    expect(buildVehicleImportUpdate({ matricula: "9772NNS", modelo: "", categoria: "  " }, null)).toEqual({});
    const update = buildVehicleImportUpdate({ matricula: "9772NNS", modelo: "GLA", categoria: "SUV" }, "loc-1");
    expect(update).toEqual({ modelo: "GLA", categoria: "SUV", location_id: "loc-1" });
    expect(Object.keys(update)).not.toEqual(expect.arrayContaining(["status", "is_archived", "matricula"]));
  });
});

describe("syncVehicleStatuses plate identity", () => {
  let tables: Tables;
  beforeEach(() => {
    tables = {
      vehicles: [],
      reservations: [],
      vehicle_identity_aliases: [],
      vehicle_cleaning_tasks: [],
      fleet_vehicles: [{ id: "fleet-x", organization_id: ORG1, matricula: "ZZZ", numero_bastidor: null }],
    };
  });

  it("links a Rently plate without space to the manual record with space; repeated sync is a no-op", async () => {
    tables.vehicles.push(vehicle({ id: "manual", matricula: "9772 NNS", location_id: "campa", modelo: "Mercedes GLA" }));
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772NNS" }));
    const { client, writes } = makeFakeClient(tables);
    const first = await syncVehicleStatuses(client, ORG1);
    expect(first).toMatchObject({ rented: 1, errors: 0 });
    expect(plateKeyCount(tables, ORG1, "9772NNS")).toBe(1);
    expect(tables.vehicles[0]).toMatchObject({
      id: "manual", matricula: "9772 NNS", status: "alquilado", current_reservation_id: "res-1",
      location_id: "campa", modelo: "Mercedes GLA",
    });
    const before = writes.length;
    const second = await syncVehicleStatuses(client, ORG1);
    expect(second).toMatchObject({ rented: 0, released: 0, errors: 0 });
    expect(writes.length).toBe(before);
    expect(plateKeyCount(tables, ORG1, "9772NNS")).toBe(1);
  });

  it("does not release a rented car whose reservation uses the other plate format", async () => {
    tables.vehicles.push(vehicle({ id: "v", matricula: "9772 NNS", status: "alquilado", current_reservation_id: "res-1" }));
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772nns" }));
    const { client } = makeFakeClient(tables);
    const out = await syncVehicleStatuses(client, ORG1);
    expect(out).toMatchObject({ released: 0, errors: 0 });
    expect(tables.vehicles[0]).toMatchObject({ status: "alquilado", current_reservation_id: "res-1" });
  });

  it("never uses or touches another organization's vehicle with the same plate", async () => {
    tables.vehicles.push(vehicle({ id: "other", organization_id: ORG2, matricula: "9772NNS", status: "limpio" }));
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772 nns" }));
    const { client } = makeFakeClient(tables);
    await syncVehicleStatuses(client, ORG1);
    expect(tables.vehicles.find((v) => v.id === "other")).toMatchObject({ status: "limpio", current_reservation_id: null });
    expect(plateKeyCount(tables, ORG1, "9772NNS")).toBe(1);
    expect(plateKeyCount(tables, ORG2, "9772NNS")).toBe(1);
  });

  it("skips ambiguous identities without updating or creating", async () => {
    tables.vehicles.push(vehicle({ id: "a", matricula: "9772 NNS" }), vehicle({ id: "b", matricula: "9772NNS" }));
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772NNS" }));
    const { client, writes } = makeFakeClient(tables);
    const out = await syncVehicleStatuses(client, ORG1);
    expect(out.errors).toBeGreaterThanOrEqual(1);
    expect(writes.filter((w) => w.table === "vehicles")).toHaveLength(0);
    expect(plateKeyCount(tables, ORG1, "9772NNS")).toBe(2);
  });

  it("never resurrects a consolidated alias nor creates a third record", async () => {
    tables.vehicles.push(vehicle({ id: "alias", matricula: "9772 NNS", is_archived: true, status: "limpio" }));
    tables.vehicle_identity_aliases.push({ organization_id: ORG1, alias_vehicle_id: "alias", status: "active" });
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772NNS" }));
    const { client, writes } = makeFakeClient(tables);
    await syncVehicleStatuses(client, ORG1);
    expect(tables.vehicles[0]).toMatchObject({ is_archived: true, status: "limpio" });
    expect(writes.filter((w) => w.table === "vehicles")).toHaveLength(0);
  });

  it("does not restore archived records when the alias registry is unreadable", async () => {
    tables.vehicles.push(vehicle({ id: "arch", matricula: "9772 NNS", is_archived: true }));
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772NNS" }));
    const { client, writes } = makeFakeClient(tables, { failAliasRead: true });
    const out = await syncVehicleStatuses(client, ORG1);
    expect(out.errors).toBeGreaterThanOrEqual(1);
    expect(writes.filter((w) => w.table === "vehicles")).toHaveLength(0);
  });

  it("concurrent creation of the same unit links to the winner instead of duplicating", async () => {
    tables.reservations.push(activeRes({ id: "res-1", auto: "9772NNS" }));
    const { client } = makeFakeClient(tables, {
      beforeVehicleInsert: (t) => {
        if (!t.vehicles.some((v) => v.id === "winner")) {
          t.vehicles.push(vehicle({ id: "winner", matricula: "9772 NNS", fleet_vehicle_id: "fleet-x" }));
        }
      },
    });
    const out = await syncVehicleStatuses(client, ORG1);
    expect(plateKeyCount(tables, ORG1, "9772NNS")).toBe(1);
    expect(tables.vehicles.find((v) => v.id === "winner")).toMatchObject({ status: "alquilado", current_reservation_id: "res-1" });
    expect(out.rented).toBe(1);
  });

  it("links an orphan to fleet by normalized plate and refuses contradictory VINs", async () => {
    tables.vehicles.push(
      vehicle({ id: "o1", matricula: "9772 NNS", fleet_vehicle_id: null }),
      vehicle({ id: "o2", matricula: "1234ABC", fleet_vehicle_id: null }),
    );
    tables.fleet_vehicles.push(
      { id: "f-b", organization_id: ORG1, matricula: "9772NNS", numero_bastidor: "VINSYNTH0000000001" },
      { id: "f-c1", organization_id: ORG1, matricula: "1234 ABC", numero_bastidor: "VINSYNTH0000000002" },
      { id: "f-c2", organization_id: ORG1, matricula: "1234ABC", numero_bastidor: "VINSYNTH0000000003" },
    );
    const fleetBefore = tables.fleet_vehicles.length;
    const { client } = makeFakeClient(tables);
    const out = await syncVehicleStatuses(client, ORG1);
    expect(tables.vehicles.find((v) => v.id === "o1")?.fleet_vehicle_id).toBe("f-b");
    expect(tables.vehicles.find((v) => v.id === "o2")?.fleet_vehicle_id).toBeNull();
    expect(tables.fleet_vehicles.length).toBe(fleetBefore);
    expect(out.errors).toBe(1);
  });
});
