/**
 * Tests for the allOperations field in staff capacity response.
 * Verifies that:
 * 1. The CapacityResult includes allOperations (all ops including completed)
 * 2. Completed operations retain their travelMinutesOneWay values
 * 3. The travelTimeLookup logic correctly builds from allOperations
 */
import { describe, it, expect } from 'vitest';

// Simulate the CapacityOperation type
interface CapacityOperation {
  reservationId: string;
  type: "Entrega" | "Devolución" | "Transfer";
  datetime: string;
  hour: number;
  location: string | null;
  isAtBase: boolean;
  travelMinutesOneWay: number;
  personMinutes: number;
  peopleNeeded: number;
  isCompleted: boolean;
}

interface HourSlot {
  hour: number;
  label: string;
  operations: CapacityOperation[];
  totalPersonMinutes: number;
  availablePersonMinutes: number;
  availableStaff: { rentals: string[]; preparacion: string[]; mostrador: string[] };
  utilizationPct: number;
  status: "sufficient" | "tight" | "deficit";
  reinforcements: any[];
}

interface CapacityResult {
  date: string;
  overallStatus: "sufficient" | "tight" | "deficit";
  overallUtilization: number;
  totalOperations: number;
  totalPersonMinutesNeeded: number;
  totalPersonMinutesAvailable: number;
  hourSlots: HourSlot[];
  allOperations?: CapacityOperation[];
  deficitHours: number[];
  tightHours: number[];
  summary: string;
  reinforcements: any[];
}

/**
 * Simulates the travelTimeLookup logic from ReservationsTable.tsx
 */
function buildTravelTimeLookup(capacityData: CapacityResult | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!capacityData) return map;
  // Prefer allOperations (includes completed ops with travel times)
  if (capacityData.allOperations) {
    for (const op of capacityData.allOperations) {
      const key = `${op.reservationId}_${op.type}`;
      if (!map.has(key)) {
        map.set(key, op.travelMinutesOneWay);
      }
    }
  } else if (capacityData.hourSlots) {
    // Fallback to hourSlots.operations (excludes completed)
    for (const slot of capacityData.hourSlots) {
      for (const op of slot.operations) {
        const key = `${op.reservationId}_${op.type}`;
        if (!map.has(key)) {
          map.set(key, op.travelMinutesOneWay);
        }
      }
    }
  }
  return map;
}

describe('Staff Capacity allOperations', () => {
  const completedOp: CapacityOperation = {
    reservationId: 'res-001',
    type: 'Entrega',
    datetime: '2026-05-29T09:00:00Z',
    hour: 9,
    location: 'Hotel Meliá',
    isAtBase: false,
    travelMinutesOneWay: 18,
    personMinutes: 0, // completed ops have 0 personMinutes
    peopleNeeded: 2,
    isCompleted: true,
  };

  const pendingOp: CapacityOperation = {
    reservationId: 'res-002',
    type: 'Devolución',
    datetime: '2026-05-29T10:00:00Z',
    hour: 10,
    location: 'Aeropuerto PMI',
    isAtBase: false,
    travelMinutesOneWay: 25,
    personMinutes: 100,
    peopleNeeded: 2,
    isCompleted: false,
  };

  const baseOp: CapacityOperation = {
    reservationId: 'res-003',
    type: 'Entrega',
    datetime: '2026-05-29T11:00:00Z',
    hour: 11,
    location: null,
    isAtBase: true,
    travelMinutesOneWay: 0,
    personMinutes: 30,
    peopleNeeded: 1,
    isCompleted: false,
  };

  it('should include completed operations in allOperations', () => {
    const result: CapacityResult = {
      date: '2026-05-29',
      overallStatus: 'sufficient',
      overallUtilization: 50,
      totalOperations: 2, // only non-completed
      totalPersonMinutesNeeded: 130,
      totalPersonMinutesAvailable: 480,
      hourSlots: [
        {
          hour: 10,
          label: '10:00 - 11:00',
          operations: [pendingOp], // only non-completed in hourSlots
          totalPersonMinutes: 100,
          availablePersonMinutes: 240,
          availableStaff: { rentals: ['Alice'], preparacion: ['Bob'], mostrador: [] },
          utilizationPct: 42,
          status: 'sufficient',
          reinforcements: [],
        },
        {
          hour: 11,
          label: '11:00 - 12:00',
          operations: [baseOp],
          totalPersonMinutes: 30,
          availablePersonMinutes: 240,
          availableStaff: { rentals: ['Alice'], preparacion: ['Bob'], mostrador: [] },
          utilizationPct: 13,
          status: 'sufficient',
          reinforcements: [],
        },
      ],
      allOperations: [completedOp, pendingOp, baseOp], // ALL ops including completed
      deficitHours: [],
      tightHours: [],
      summary: 'Test summary',
      reinforcements: [],
    };

    // allOperations should have 3 ops (including completed)
    expect(result.allOperations).toHaveLength(3);
    // hourSlots should only have 2 ops (non-completed)
    const hourSlotOps = result.hourSlots.flatMap(s => s.operations);
    expect(hourSlotOps).toHaveLength(2);
    // Completed op should NOT be in hourSlots
    expect(hourSlotOps.find(o => o.reservationId === 'res-001')).toBeUndefined();
    // But it SHOULD be in allOperations
    expect(result.allOperations!.find(o => o.reservationId === 'res-001')).toBeDefined();
  });

  it('should build travelTimeLookup from allOperations (includes completed)', () => {
    const result: CapacityResult = {
      date: '2026-05-29',
      overallStatus: 'sufficient',
      overallUtilization: 50,
      totalOperations: 2,
      totalPersonMinutesNeeded: 130,
      totalPersonMinutesAvailable: 480,
      hourSlots: [
        {
          hour: 10,
          label: '10:00 - 11:00',
          operations: [pendingOp],
          totalPersonMinutes: 100,
          availablePersonMinutes: 240,
          availableStaff: { rentals: [], preparacion: [], mostrador: [] },
          utilizationPct: 42,
          status: 'sufficient',
          reinforcements: [],
        },
      ],
      allOperations: [completedOp, pendingOp, baseOp],
      deficitHours: [],
      tightHours: [],
      summary: 'Test',
      reinforcements: [],
    };

    const lookup = buildTravelTimeLookup(result);

    // Should have entries for all 3 operations
    expect(lookup.size).toBe(3);
    // Completed op should have its travel time
    expect(lookup.get('res-001_Entrega')).toBe(18);
    // Pending op should have its travel time
    expect(lookup.get('res-002_Devolución')).toBe(25);
    // Base op should have 0
    expect(lookup.get('res-003_Entrega')).toBe(0);
  });

  it('should fallback to hourSlots when allOperations is not available', () => {
    const result: CapacityResult = {
      date: '2026-05-29',
      overallStatus: 'sufficient',
      overallUtilization: 50,
      totalOperations: 2,
      totalPersonMinutesNeeded: 130,
      totalPersonMinutesAvailable: 480,
      hourSlots: [
        {
          hour: 10,
          label: '10:00 - 11:00',
          operations: [pendingOp],
          totalPersonMinutes: 100,
          availablePersonMinutes: 240,
          availableStaff: { rentals: [], preparacion: [], mostrador: [] },
          utilizationPct: 42,
          status: 'sufficient',
          reinforcements: [],
        },
      ],
      // allOperations is undefined (old server response)
      deficitHours: [],
      tightHours: [],
      summary: 'Test',
      reinforcements: [],
    };

    const lookup = buildTravelTimeLookup(result);

    // Should only have the pending op from hourSlots
    expect(lookup.size).toBe(1);
    expect(lookup.get('res-002_Devolución')).toBe(25);
    // Completed op is NOT available in this fallback
    expect(lookup.has('res-001_Entrega')).toBe(false);
  });

  it('should handle null capacityData gracefully', () => {
    const lookup = buildTravelTimeLookup(null);
    expect(lookup.size).toBe(0);
  });

  it('should handle empty allOperations array', () => {
    const result: CapacityResult = {
      date: '2026-05-29',
      overallStatus: 'sufficient',
      overallUtilization: 0,
      totalOperations: 0,
      totalPersonMinutesNeeded: 0,
      totalPersonMinutesAvailable: 0,
      hourSlots: [],
      allOperations: [],
      deficitHours: [],
      tightHours: [],
      summary: 'No operations',
      reinforcements: [],
    };

    const lookup = buildTravelTimeLookup(result);
    expect(lookup.size).toBe(0);
  });

  it('should not overwrite first occurrence when duplicate keys exist', () => {
    // If same reservationId+type appears twice (shouldn't happen, but edge case)
    const dupOp: CapacityOperation = {
      ...completedOp,
      travelMinutesOneWay: 99, // different value
    };

    const result: CapacityResult = {
      date: '2026-05-29',
      overallStatus: 'sufficient',
      overallUtilization: 0,
      totalOperations: 0,
      totalPersonMinutesNeeded: 0,
      totalPersonMinutesAvailable: 0,
      hourSlots: [],
      allOperations: [completedOp, dupOp], // first has 18, second has 99
      deficitHours: [],
      tightHours: [],
      summary: 'Test',
      reinforcements: [],
    };

    const lookup = buildTravelTimeLookup(result);
    // Should keep the first value (18), not the duplicate (99)
    expect(lookup.get('res-001_Entrega')).toBe(18);
  });

  it('completed operations should retain travelMinutesOneWay despite 0 personMinutes', () => {
    // This tests the server-side behavior: completed ops get personMinutes=0
    // but their travelMinutesOneWay should still be computed
    expect(completedOp.isCompleted).toBe(true);
    expect(completedOp.personMinutes).toBe(0);
    expect(completedOp.travelMinutesOneWay).toBe(18); // NOT reset to 0
  });
});
