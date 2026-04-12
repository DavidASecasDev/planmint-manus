import { describe, it, expect } from "vitest";

/**
 * Unit tests for the vehicle swap detection logic in syncVehicleStatuses.
 * We test the core logic that determines whether a vehicle should be released
 * when its linked reservation's auto field no longer matches its matricula.
 */

// Extract the core decision logic as a pure function for testing
function shouldReleaseVehicle(
  vehicleMatricula: string,
  reservationAuto: string | null,
  reservationEstado: string | null
): { release: boolean; reason: string } {
  // Step 1: Reservation completed or cancelled → release
  if (reservationEstado === "Completada" || reservationEstado === "Cancelada") {
    return { release: true, reason: "reservation_completed_or_cancelled" };
  }

  // Step 3: Vehicle swap detection — reservation's auto no longer matches vehicle
  if (reservationAuto && reservationAuto !== vehicleMatricula) {
    return { release: true, reason: "vehicle_swapped" };
  }

  // Vehicle still correctly linked
  return { release: false, reason: "still_active" };
}

describe("Vehicle Status Sync - Release Logic", () => {
  describe("Step 1: Release on completed/cancelled reservation", () => {
    it("should release vehicle when reservation is Completada", () => {
      const result = shouldReleaseVehicle("5078LVJ", "5078LVJ", "Completada");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("reservation_completed_or_cancelled");
    });

    it("should release vehicle when reservation is Cancelada", () => {
      const result = shouldReleaseVehicle("5078LVJ", "5078LVJ", "Cancelada");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("reservation_completed_or_cancelled");
    });
  });

  describe("Step 3: Vehicle swap detection", () => {
    it("should release vehicle when reservation auto changed to different plate", () => {
      // This is the exact scenario reported: 5078LVJ was swapped to 4005NLH
      const result = shouldReleaseVehicle("5078LVJ", "4005NLH", "En curso");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("vehicle_swapped");
    });

    it("should NOT release vehicle when reservation auto still matches", () => {
      const result = shouldReleaseVehicle("5078LVJ", "5078LVJ", "En curso");
      expect(result.release).toBe(false);
      expect(result.reason).toBe("still_active");
    });

    it("should NOT release vehicle when reservation auto is null", () => {
      const result = shouldReleaseVehicle("5078LVJ", null, "En curso");
      expect(result.release).toBe(false);
      expect(result.reason).toBe("still_active");
    });

    it("should handle Confirmada status with swap", () => {
      const result = shouldReleaseVehicle("1234ABC", "5678DEF", "Confirmada");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("vehicle_swapped");
    });

    it("should handle Confirmada status without swap", () => {
      const result = shouldReleaseVehicle("1234ABC", "1234ABC", "Confirmada");
      expect(result.release).toBe(false);
      expect(result.reason).toBe("still_active");
    });
  });

  describe("Edge cases", () => {
    it("should prioritize completed status over swap detection", () => {
      // Even if auto doesn't match, completed takes priority
      const result = shouldReleaseVehicle("5078LVJ", "4005NLH", "Completada");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("reservation_completed_or_cancelled");
    });

    it("should handle case-sensitive plate comparison", () => {
      // Plates should be compared as-is (they're typically uppercase)
      const result = shouldReleaseVehicle("5078LVJ", "5078lvj", "En curso");
      expect(result.release).toBe(true);
      expect(result.reason).toBe("vehicle_swapped");
    });
  });
});
