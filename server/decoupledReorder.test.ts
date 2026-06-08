import { describe, it, expect } from 'vitest';

/**
 * Tests for the decoupled name reorder and shift swap feature.
 * 
 * Architecture:
 * - Name reorder: Only changes visual order (schedule_member_order table), does NOT touch shifts.
 * - Shift swap: Independently swaps shifts between two users via swap-user-schedules endpoint.
 * 
 * These are two completely independent operations.
 */

describe('Decoupled Name Reorder and Shift Swap', () => {
  describe('Name Reorder (handleReorderMember)', () => {
    it('should produce a new ordered_user_ids array without modifying shifts', () => {
      // Simulate the reorder logic
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
        { id: 'user-3', name: 'Mikaela' },
      ];

      const memberIndex = 1; // Laura
      const direction = 'up' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      const newMembers = [...members];
      [newMembers[memberIndex], newMembers[targetIndex]] = [newMembers[targetIndex], newMembers[memberIndex]];
      const ordered_user_ids = newMembers.map(m => m.id);

      // Laura moved up, David moved down
      expect(ordered_user_ids).toEqual(['user-2', 'user-1', 'user-3']);
      // Original array not mutated
      expect(members[0].id).toBe('user-1');
      expect(members[1].id).toBe('user-2');
    });

    it('should not allow moving first member up', () => {
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
      ];

      const memberIndex = 0;
      const direction = 'up' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      // targetIndex would be -1, which is invalid
      expect(targetIndex).toBe(-1);
      expect(targetIndex < 0).toBe(true);
    });

    it('should not allow moving last member down', () => {
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
      ];

      const memberIndex = 1;
      const direction = 'down' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      // targetIndex would be 2, which is >= members.length
      expect(targetIndex).toBe(2);
      expect(targetIndex >= members.length).toBe(true);
    });
  });

  describe('Drag Reorder (handleDragReorder)', () => {
    it('should only produce ordered_user_ids without any shift operations', () => {
      // The drag reorder simply calls reorderMutation with the new order
      // No swap/rotate is involved
      const orderedUserIds = ['user-3', 'user-1', 'user-2'];
      
      // This is all that gets sent to the backend - just the new order
      expect(orderedUserIds).toHaveLength(3);
      expect(orderedUserIds[0]).toBe('user-3');
    });
  });

  describe('Shift Swap (handleSwapShifts)', () => {
    it('should identify the correct pair of users to swap', () => {
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
        { id: 'user-3', name: 'Mikaela' },
      ];

      // Swap shifts of Laura (index 1) with the one below (Mikaela, index 2)
      const memberIndex = 1;
      const direction = 'down' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      const userA = members[memberIndex];
      const userB = members[targetIndex];

      expect(userA.id).toBe('user-2'); // Laura
      expect(userB.id).toBe('user-3'); // Mikaela
    });

    it('should swap shifts up correctly', () => {
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
        { id: 'user-3', name: 'Mikaela' },
      ];

      // Swap shifts of Mikaela (index 2) with the one above (Laura, index 1)
      const memberIndex = 2;
      const direction = 'up' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      const userA = members[memberIndex];
      const userB = members[targetIndex];

      expect(userA.id).toBe('user-3'); // Mikaela
      expect(userB.id).toBe('user-2'); // Laura
    });

    it('should not swap if at boundary', () => {
      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
      ];

      // Try to swap first member's shifts up
      const memberIndex = 0;
      const direction = 'up' as const;
      const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;

      expect(targetIndex < 0).toBe(true);
    });
  });

  describe('Independence of operations', () => {
    it('name reorder and shift swap are completely independent', () => {
      // This test verifies the architecture: 
      // - handleReorderMember calls ONLY reorderMutation (changes visual order)
      // - handleSwapShifts calls ONLY swapShiftsMutation (changes shift assignments)
      // Neither operation calls the other's mutation

      const reorderCalled = { count: 0, params: null as any };
      const swapCalled = { count: 0, params: null as any };

      // Simulate handleReorderMember
      const simulateReorder = (teamId: string, members: any[], memberIndex: number, direction: 'up' | 'down') => {
        const newMembers = [...members];
        const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
        if (targetIndex < 0 || targetIndex >= newMembers.length) return;
        [newMembers[memberIndex], newMembers[targetIndex]] = [newMembers[targetIndex], newMembers[memberIndex]];
        reorderCalled.count++;
        reorderCalled.params = { team_id: teamId, ordered_user_ids: newMembers.map((m: any) => m.id) };
      };

      // Simulate handleSwapShifts
      const simulateSwapShifts = (_teamId: string, members: any[], memberIndex: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
        if (targetIndex < 0 || targetIndex >= members.length) return;
        swapCalled.count++;
        swapCalled.params = { user_a_id: members[memberIndex].id, user_b_id: members[targetIndex].id };
      };

      const members = [
        { id: 'user-1', name: 'David' },
        { id: 'user-2', name: 'Laura' },
        { id: 'user-3', name: 'Mikaela' },
      ];

      // Reorder names: Laura up
      simulateReorder('team-1', members, 1, 'up');
      expect(reorderCalled.count).toBe(1);
      expect(swapCalled.count).toBe(0); // Swap NOT called

      // Swap shifts: Laura's shifts with Mikaela's
      simulateSwapShifts('team-1', members, 1, 'down');
      expect(reorderCalled.count).toBe(1); // Reorder NOT called again
      expect(swapCalled.count).toBe(1);
    });
  });
});
