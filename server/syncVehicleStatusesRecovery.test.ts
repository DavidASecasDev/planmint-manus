import { describe, it, expect } from "vitest";

/**
 * Unit tests for the vehicle recovery logic in syncVehicleStatuses (Step 2).
 * Tests the decision logic for handling active reservations where:
 * - The vehicle exists but is archived → should unarchive
 * - The vehicle doesn't exist at all → should create
 * - The vehicle exists and is not archived → normal flow
 */

type VehicleRecord = {
  id: string;
  status: string;
  current_reservation_id: string | null;
  is_archived: boolean;
} | null;

type ArchivedVehicleRecord = {
  id: string;
  status: string;
} | null;

type ActionResult = {
  action: "set_alquilado" | "update_reservation_id" | "unarchive" | "create" | "skip";
  reason: string;
};

/**
 * Pure function that mirrors the decision logic in syncVehicleStatuses step 2.
 * Given the state of a non-archived vehicle lookup and an archived vehicle lookup,
 * determines what action to take.
 */
function determineVehicleAction(
  activeVehicle: VehicleRecord,
  archivedVehicle: ArchivedVehicleRecord,
  reservationId: string
): ActionResult {
  if (activeVehicle) {
    // Vehicle exists and is not archived
    if (activeVehicle.status !== "alquilado" && activeVehicle.status !== "en_servicio") {
      return { action: "set_alquilado", reason: "vehicle_available_set_rented" };
    } else if (activeVehicle.status === "alquilado" && activeVehicle.current_reservation_id !== reservationId) {
      return { action: "update_reservation_id", reason: "vehicle_rented_update_link" };
    } else {
      return { action: "skip", reason: "vehicle_already_correctly_linked" };
    }
  }

  // Vehicle not found as non-archived
  if (archivedVehicle) {
    return { action: "unarchive", reason: "vehicle_archived_with_active_reservation" };
  }

  // Vehicle doesn't exist at all
  return { action: "create", reason: "vehicle_missing_with_active_reservation" };
}

describe("Vehicle Status Sync - Recovery Logic (Step 2)", () => {
  describe("Normal flow: vehicle exists and is not archived", () => {
    it("should set to alquilado when vehicle is sucio", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "sucio", current_reservation_id: null, is_archived: false },
        null,
        "res1"
      );
      expect(result.action).toBe("set_alquilado");
      expect(result.reason).toBe("vehicle_available_set_rented");
    });

    it("should set to alquilado when vehicle is limpio", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "limpio", current_reservation_id: null, is_archived: false },
        null,
        "res1"
      );
      expect(result.action).toBe("set_alquilado");
      expect(result.reason).toBe("vehicle_available_set_rented");
    });

    it("should set to alquilado when vehicle is incompleto", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "incompleto", current_reservation_id: null, is_archived: false },
        null,
        "res1"
      );
      expect(result.action).toBe("set_alquilado");
      expect(result.reason).toBe("vehicle_available_set_rented");
    });

    it("should update reservation_id when already alquilado but linked to different reservation", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "alquilado", current_reservation_id: "old-res", is_archived: false },
        null,
        "new-res"
      );
      expect(result.action).toBe("update_reservation_id");
      expect(result.reason).toBe("vehicle_rented_update_link");
    });

    it("should skip when already alquilado and correctly linked", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "alquilado", current_reservation_id: "res1", is_archived: false },
        null,
        "res1"
      );
      expect(result.action).toBe("skip");
      expect(result.reason).toBe("vehicle_already_correctly_linked");
    });

    it("should skip when vehicle is en_servicio (don't override service status)", () => {
      const result = determineVehicleAction(
        { id: "v1", status: "en_servicio", current_reservation_id: null, is_archived: false },
        null,
        "res1"
      );
      expect(result.action).toBe("skip");
      expect(result.reason).toBe("vehicle_already_correctly_linked");
    });
  });

  describe("Recovery: vehicle is archived", () => {
    it("should unarchive when vehicle exists but is archived", () => {
      const result = determineVehicleAction(
        null, // not found as non-archived
        { id: "v1", status: "alquilado" }, // found as archived
        "res1"
      );
      expect(result.action).toBe("unarchive");
      expect(result.reason).toBe("vehicle_archived_with_active_reservation");
    });

    it("should unarchive regardless of archived vehicle's previous status", () => {
      const result = determineVehicleAction(
        null,
        { id: "v1", status: "sucio" },
        "res1"
      );
      expect(result.action).toBe("unarchive");
      expect(result.reason).toBe("vehicle_archived_with_active_reservation");
    });

    it("should unarchive when archived vehicle was en_servicio", () => {
      const result = determineVehicleAction(
        null,
        { id: "v1", status: "en_servicio" },
        "res1"
      );
      expect(result.action).toBe("unarchive");
      expect(result.reason).toBe("vehicle_archived_with_active_reservation");
    });
  });

  describe("Recovery: vehicle doesn't exist", () => {
    it("should create when vehicle not found anywhere", () => {
      const result = determineVehicleAction(
        null, // not found as non-archived
        null, // not found as archived either
        "res1"
      );
      expect(result.action).toBe("create");
      expect(result.reason).toBe("vehicle_missing_with_active_reservation");
    });
  });

  describe("Priority: non-archived vehicle takes precedence over archived", () => {
    it("should use non-archived vehicle even if archived version also exists", () => {
      // In practice, the unique constraint prevents this, but the logic should
      // still handle it correctly by prioritizing the non-archived lookup
      const result = determineVehicleAction(
        { id: "v1", status: "sucio", current_reservation_id: null, is_archived: false },
        { id: "v2", status: "alquilado" }, // this would be ignored
        "res1"
      );
      expect(result.action).toBe("set_alquilado");
      expect(result.reason).toBe("vehicle_available_set_rented");
    });
  });
});
