import { describe, it, expect } from "vitest";

/**
 * safeStr — mirrors the client-side helper in Bookings.tsx.
 * Safely extract a display string from a Rently field that may be a string or an object.
 */
function safeStr(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.Name === "string" && obj.Name) return obj.Name;
    if (typeof obj.BranchOfficeName === "string" && obj.BranchOfficeName) return obj.BranchOfficeName;
    if (typeof obj.Address === "string" && obj.Address) return obj.Address;
    if (typeof obj.City === "string" && obj.City) return obj.City;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v) return v;
    }
  }
  return "";
}

describe("safeStr — Rently field extractor", () => {
  it("returns empty string for null/undefined", () => {
    expect(safeStr(null)).toBe("");
    expect(safeStr(undefined)).toBe("");
  });

  it("returns the string as-is", () => {
    expect(safeStr("Aeropuerto Palma")).toBe("Aeropuerto Palma");
    expect(safeStr("")).toBe("");
  });

  it("converts numbers to string", () => {
    expect(safeStr(42)).toBe("42");
    expect(safeStr(0)).toBe("0");
  });

  it("converts booleans to string", () => {
    expect(safeStr(true)).toBe("true");
    expect(safeStr(false)).toBe("false");
  });

  it("extracts Name from Rently place object", () => {
    const place = {
      Id: 1,
      Price: 0,
      Name: "Aeropuerto PMI",
      Category: "Airport",
      Address: "Carretera Aeropuerto",
      City: "Palma",
      Country: "Spain",
      BranchOfficeId: 1,
      BranchOfficeName: "Oficina Central",
      BranchOfficeIATACode: "PMI",
      IsFranchise: false,
      Latitude: 39.55,
      Longitude: 2.73,
      CanAddCustomAddress: true,
      IsCustomAddress: false,
      AvailableOperationOptions: [],
      AvailableReturnPlaces: [],
      AvailableBrandCodes: [],
    };
    expect(safeStr(place)).toBe("Aeropuerto PMI");
  });

  it("falls back to BranchOfficeName when Name is missing", () => {
    const place = { Id: 1, BranchOfficeName: "Oficina Playa", City: "Alcudia" };
    expect(safeStr(place)).toBe("Oficina Playa");
  });

  it("falls back to Address when Name and BranchOfficeName are missing", () => {
    const place = { Id: 1, Address: "Calle Mayor 5", City: "Madrid" };
    expect(safeStr(place)).toBe("Calle Mayor 5");
  });

  it("falls back to City when higher-priority fields are missing", () => {
    const place = { Id: 1, City: "Barcelona", Latitude: 41.38 };
    expect(safeStr(place)).toBe("Barcelona");
  });

  it("falls back to first string value for unknown objects", () => {
    const obj = { id: 123, code: "ABC", active: true };
    expect(safeStr(obj)).toBe("ABC");
  });

  it("returns empty string for object with no string values", () => {
    const obj = { id: 123, active: true, count: 5 };
    expect(safeStr(obj)).toBe("");
  });

  it("handles Category as an object", () => {
    const cat = { Name: "Económico", Id: 3 };
    expect(safeStr(cat)).toBe("Económico");
  });

  it("handles Source as an object", () => {
    const source = { Name: "Web", Id: 1 };
    expect(safeStr(source)).toBe("Web");
  });
});
