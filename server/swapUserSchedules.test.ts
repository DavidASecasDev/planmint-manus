/**
 * Unit tests for the swap-user-schedules endpoint logic.
 * Tests the schedule swap behavior when reordering employees.
 */
import { describe, it, expect } from "vitest";

// Simulate the swap logic used in handleSwapUserSchedules
function simulateSwap(
  schedulesA: { date: string; shift_template_id: string | null; team_id: string | null; notes: string | null }[],
  schedulesB: { date: string; shift_template_id: string | null; team_id: string | null; notes: string | null }[]
) {
  const mapA = new Map<string, any>();
  for (const s of schedulesA) mapA.set(s.date, s);

  const mapB = new Map<string, any>();
  for (const s of schedulesB) mapB.set(s.date, s);

  const allDates = new Set<string>();
  for (const s of schedulesA) allDates.add(s.date);
  for (const s of schedulesB) allDates.add(s.date);

  const resultA: any[] = [];
  const resultB: any[] = [];
  const deletedA: string[] = [];
  const deletedB: string[] = [];

  for (const date of Array.from(allDates)) {
    const entryA = mapA.get(date);
    const entryB = mapB.get(date);

    if (entryA && entryB) {
      // Both have entries: swap
      resultA.push({ date, shift_template_id: entryB.shift_template_id, team_id: entryB.team_id, notes: entryB.notes });
      resultB.push({ date, shift_template_id: entryA.shift_template_id, team_id: entryA.team_id, notes: entryA.notes });
    } else if (entryA && !entryB) {
      // A has entry, B doesn't: move A's shift to B, delete A
      resultB.push({ date, shift_template_id: entryA.shift_template_id, team_id: entryA.team_id, notes: entryA.notes });
      deletedA.push(date);
    } else if (!entryA && entryB) {
      // B has entry, A doesn't: move B's shift to A, delete B
      resultA.push({ date, shift_template_id: entryB.shift_template_id, team_id: entryB.team_id, notes: entryB.notes });
      deletedB.push(date);
    }
  }

  return { resultA, resultB, deletedA, deletedB };
}

describe("swap-user-schedules logic", () => {
  it("should swap shifts between two users when both have entries on same dates", () => {
    const schedulesA = [
      { date: "2026-06-15", shift_template_id: "shift-morning", team_id: "team-1", notes: null },
      { date: "2026-06-16", shift_template_id: "shift-afternoon", team_id: "team-1", notes: "note-a" },
    ];
    const schedulesB = [
      { date: "2026-06-15", shift_template_id: "shift-night", team_id: "team-1", notes: null },
      { date: "2026-06-16", shift_template_id: "shift-morning", team_id: "team-1", notes: "note-b" },
    ];

    const { resultA, resultB, deletedA, deletedB } = simulateSwap(schedulesA, schedulesB);

    // After swap, A should have B's shifts and vice versa
    expect(resultA).toHaveLength(2);
    expect(resultB).toHaveLength(2);
    expect(deletedA).toHaveLength(0);
    expect(deletedB).toHaveLength(0);

    const aOnJun15 = resultA.find(r => r.date === "2026-06-15");
    expect(aOnJun15?.shift_template_id).toBe("shift-night"); // was B's shift

    const bOnJun15 = resultB.find(r => r.date === "2026-06-15");
    expect(bOnJun15?.shift_template_id).toBe("shift-morning"); // was A's shift

    const aOnJun16 = resultA.find(r => r.date === "2026-06-16");
    expect(aOnJun16?.shift_template_id).toBe("shift-morning"); // was B's shift
    expect(aOnJun16?.notes).toBe("note-b"); // B's notes

    const bOnJun16 = resultB.find(r => r.date === "2026-06-16");
    expect(bOnJun16?.shift_template_id).toBe("shift-afternoon"); // was A's shift
    expect(bOnJun16?.notes).toBe("note-a"); // A's notes
  });

  it("should move A's shift to B and delete A when B has no entry on that date", () => {
    const schedulesA = [
      { date: "2026-06-15", shift_template_id: "shift-morning", team_id: "team-1", notes: null },
      { date: "2026-06-17", shift_template_id: "shift-night", team_id: "team-1", notes: null },
    ];
    const schedulesB = [
      { date: "2026-06-15", shift_template_id: "shift-afternoon", team_id: "team-1", notes: null },
      // B has no entry on 2026-06-17
    ];

    const { resultA, resultB, deletedA, deletedB } = simulateSwap(schedulesA, schedulesB);

    // Jun 15: both have entries, swap normally
    const aOnJun15 = resultA.find(r => r.date === "2026-06-15");
    expect(aOnJun15?.shift_template_id).toBe("shift-afternoon");

    const bOnJun15 = resultB.find(r => r.date === "2026-06-15");
    expect(bOnJun15?.shift_template_id).toBe("shift-morning");

    // Jun 17: only A has entry, so it moves to B and A is deleted
    const bOnJun17 = resultB.find(r => r.date === "2026-06-17");
    expect(bOnJun17?.shift_template_id).toBe("shift-night");
    expect(deletedA).toContain("2026-06-17");
  });

  it("should move B's shift to A and delete B when A has no entry on that date", () => {
    const schedulesA: any[] = [];
    const schedulesB = [
      { date: "2026-06-18", shift_template_id: "shift-libre", team_id: "team-2", notes: "day off" },
    ];

    const { resultA, resultB, deletedA, deletedB } = simulateSwap(schedulesA, schedulesB);

    // B's shift should move to A
    expect(resultA).toHaveLength(1);
    expect(resultA[0].shift_template_id).toBe("shift-libre");
    expect(resultA[0].notes).toBe("day off");
    // B should be deleted for that date
    expect(deletedB).toContain("2026-06-18");
  });

  it("should handle empty schedules for both users (no-op)", () => {
    const { resultA, resultB, deletedA, deletedB } = simulateSwap([], []);

    expect(resultA).toHaveLength(0);
    expect(resultB).toHaveLength(0);
    expect(deletedA).toHaveLength(0);
    expect(deletedB).toHaveLength(0);
  });

  it("should handle a full week swap correctly", () => {
    const dates = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"];
    const schedulesA = dates.map(date => ({
      date,
      shift_template_id: `shift-a-${date}`,
      team_id: "team-1",
      notes: null,
    }));
    const schedulesB = dates.map(date => ({
      date,
      shift_template_id: `shift-b-${date}`,
      team_id: "team-1",
      notes: null,
    }));

    const { resultA, resultB } = simulateSwap(schedulesA, schedulesB);

    expect(resultA).toHaveLength(7);
    expect(resultB).toHaveLength(7);

    // Each day: A now has B's shift and vice versa
    for (const date of dates) {
      const aEntry = resultA.find(r => r.date === date);
      const bEntry = resultB.find(r => r.date === date);
      expect(aEntry?.shift_template_id).toBe(`shift-b-${date}`);
      expect(bEntry?.shift_template_id).toBe(`shift-a-${date}`);
    }
  });
});
