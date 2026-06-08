import { describe, it, expect } from "vitest";

/**
 * Unit tests for the rotate-user-schedules logic.
 * Tests the rotation algorithm that shifts schedules among multiple users.
 */

// Simulate the rotation logic from handleRotateUserSchedules
function simulateRotation(
  userIds: string[],
  scheduleMap: Map<string, Map<string, { shift_template_id: string; team_id: string; notes: string | null }>>
): Map<string, Map<string, { shift_template_id: string; team_id: string; notes: string | null }>> {
  // Collect all dates
  const allDates = new Set<string>();
  for (const [, dateMap] of scheduleMap) {
    for (const date of dateMap.keys()) allDates.add(date);
  }

  // Build result map
  const result = new Map<string, Map<string, { shift_template_id: string; team_id: string; notes: string | null }>>();
  for (const uid of userIds) {
    result.set(uid, new Map());
  }

  // Rotation: user at position i gets shifts from user at position (i+1) % length
  for (const date of Array.from(allDates)) {
    for (let i = 0; i < userIds.length; i++) {
      const targetUserId = userIds[i];
      const sourceUserId = userIds[(i + 1) % userIds.length];
      const sourceEntry = scheduleMap.get(sourceUserId)?.get(date);

      if (sourceEntry) {
        result.get(targetUserId)!.set(date, { ...sourceEntry });
      }
      // If source has no entry, target gets nothing (effectively deleted)
    }
  }

  return result;
}

describe("rotate-user-schedules logic", () => {
  it("rotates schedules among 3 users correctly", () => {
    const userIds = ["user-a", "user-b", "user-c"];
    const scheduleMap = new Map<string, Map<string, any>>();

    // user-a: Mon=shift1, Tue=shift2
    scheduleMap.set("user-a", new Map([
      ["2026-06-15", { shift_template_id: "shift1", team_id: "team1", notes: null }],
      ["2026-06-16", { shift_template_id: "shift2", team_id: "team1", notes: null }],
    ]));

    // user-b: Mon=shift3, Tue=shift4
    scheduleMap.set("user-b", new Map([
      ["2026-06-15", { shift_template_id: "shift3", team_id: "team1", notes: null }],
      ["2026-06-16", { shift_template_id: "shift4", team_id: "team1", notes: null }],
    ]));

    // user-c: Mon=shift5, Tue=shift6
    scheduleMap.set("user-c", new Map([
      ["2026-06-15", { shift_template_id: "shift5", team_id: "team1", notes: null }],
      ["2026-06-16", { shift_template_id: "shift6", team_id: "team1", notes: null }],
    ]));

    const result = simulateRotation(userIds, scheduleMap);

    // After rotation: A gets B's shifts, B gets C's shifts, C gets A's shifts
    expect(result.get("user-a")!.get("2026-06-15")!.shift_template_id).toBe("shift3");
    expect(result.get("user-a")!.get("2026-06-16")!.shift_template_id).toBe("shift4");
    expect(result.get("user-b")!.get("2026-06-15")!.shift_template_id).toBe("shift5");
    expect(result.get("user-b")!.get("2026-06-16")!.shift_template_id).toBe("shift6");
    expect(result.get("user-c")!.get("2026-06-15")!.shift_template_id).toBe("shift1");
    expect(result.get("user-c")!.get("2026-06-16")!.shift_template_id).toBe("shift2");
  });

  it("rotates schedules among 2 users (equivalent to swap)", () => {
    const userIds = ["user-a", "user-b"];
    const scheduleMap = new Map<string, Map<string, any>>();

    scheduleMap.set("user-a", new Map([
      ["2026-06-15", { shift_template_id: "morning", team_id: "team1", notes: null }],
    ]));
    scheduleMap.set("user-b", new Map([
      ["2026-06-15", { shift_template_id: "evening", team_id: "team1", notes: null }],
    ]));

    const result = simulateRotation(userIds, scheduleMap);

    // A gets B's shift, B gets A's shift
    expect(result.get("user-a")!.get("2026-06-15")!.shift_template_id).toBe("evening");
    expect(result.get("user-b")!.get("2026-06-15")!.shift_template_id).toBe("morning");
  });

  it("handles missing entries (one user has no shift on a date)", () => {
    const userIds = ["user-a", "user-b", "user-c"];
    const scheduleMap = new Map<string, Map<string, any>>();

    // user-a: Mon=shift1
    scheduleMap.set("user-a", new Map([
      ["2026-06-15", { shift_template_id: "shift1", team_id: "team1", notes: null }],
    ]));

    // user-b: no shifts
    scheduleMap.set("user-b", new Map());

    // user-c: Mon=shift5
    scheduleMap.set("user-c", new Map([
      ["2026-06-15", { shift_template_id: "shift5", team_id: "team1", notes: null }],
    ]));

    const result = simulateRotation(userIds, scheduleMap);

    // A gets B's shift (none) → A has nothing for Mon
    expect(result.get("user-a")!.has("2026-06-15")).toBe(false);
    // B gets C's shift → B has shift5
    expect(result.get("user-b")!.get("2026-06-15")!.shift_template_id).toBe("shift5");
    // C gets A's shift → C has shift1
    expect(result.get("user-c")!.get("2026-06-15")!.shift_template_id).toBe("shift1");
  });

  it("rotates 4 users correctly", () => {
    const userIds = ["a", "b", "c", "d"];
    const scheduleMap = new Map<string, Map<string, any>>();

    scheduleMap.set("a", new Map([["2026-06-15", { shift_template_id: "s1", team_id: "t1", notes: null }]]));
    scheduleMap.set("b", new Map([["2026-06-15", { shift_template_id: "s2", team_id: "t1", notes: null }]]));
    scheduleMap.set("c", new Map([["2026-06-15", { shift_template_id: "s3", team_id: "t1", notes: null }]]));
    scheduleMap.set("d", new Map([["2026-06-15", { shift_template_id: "s4", team_id: "t1", notes: null }]]));

    const result = simulateRotation(userIds, scheduleMap);

    // a gets b's, b gets c's, c gets d's, d gets a's
    expect(result.get("a")!.get("2026-06-15")!.shift_template_id).toBe("s2");
    expect(result.get("b")!.get("2026-06-15")!.shift_template_id).toBe("s3");
    expect(result.get("c")!.get("2026-06-15")!.shift_template_id).toBe("s4");
    expect(result.get("d")!.get("2026-06-15")!.shift_template_id).toBe("s1");
  });

  it("preserves notes during rotation", () => {
    const userIds = ["user-a", "user-b"];
    const scheduleMap = new Map<string, Map<string, any>>();

    scheduleMap.set("user-a", new Map([
      ["2026-06-15", { shift_template_id: "s1", team_id: "t1", notes: "Note from A" }],
    ]));
    scheduleMap.set("user-b", new Map([
      ["2026-06-15", { shift_template_id: "s2", team_id: "t1", notes: "Note from B" }],
    ]));

    const result = simulateRotation(userIds, scheduleMap);

    expect(result.get("user-a")!.get("2026-06-15")!.notes).toBe("Note from B");
    expect(result.get("user-b")!.get("2026-06-15")!.notes).toBe("Note from A");
  });
});
