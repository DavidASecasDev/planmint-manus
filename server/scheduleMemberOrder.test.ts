import { describe, expect, it } from 'vitest';
import { buildEffectiveMemberOrder } from './scheduleMemberOrder';

interface Member {
  team_id: string;
  user_id: string;
  sort_order: number;
  name: string;
}

const teamId = 'rentals';
const members: Member[] = [
  { team_id: teamId, user_id: 'melih', sort_order: 0, name: 'Melih' },
  { team_id: teamId, user_id: 'pere', sort_order: 0, name: 'Pere' },
  { team_id: teamId, user_id: 'kristian', sort_order: 1, name: 'Kristian' },
  { team_id: teamId, user_id: 'pol', sort_order: 4, name: 'Pol' },
  { team_id: teamId, user_id: 'mitchel', sort_order: 5, name: 'Mitchel' },
  { team_id: teamId, user_id: 'carles', sort_order: 98, name: 'Carles' },
];

const approvedOrder = ['kristian', 'melih', 'carles', 'pere', 'mitchel', 'pol'];

describe('buildEffectiveMemberOrder', () => {
  it('uses the complete weekly order as the source of truth with a unique contiguous sequence', () => {
    const result = buildEffectiveMemberOrder(
      members,
      approvedOrder.map((user_id, sort_order) => ({ team_id: teamId, user_id, sort_order })),
      new Set(approvedOrder),
    );

    expect(result.members.map(member => member.user_id)).toEqual(approvedOrder);
    expect(result.members.map(member => member.sort_order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(result.customTeamIds).toEqual([teamId]);
    expect(result.validationByTeam[teamId]).toEqual({
      member_count: 6,
      displayed_count: 6,
      sequence_valid: true,
    });
  });

  it('ignores stale weekly rows and does not duplicate current employees', () => {
    const result = buildEffectiveMemberOrder(
      members,
      [
        { team_id: teamId, user_id: 'removed-old-1', sort_order: 0 },
        { team_id: teamId, user_id: 'kristian', sort_order: 0 },
        { team_id: teamId, user_id: 'melih', sort_order: 1 },
        { team_id: teamId, user_id: 'carles', sort_order: 2 },
        { team_id: teamId, user_id: 'removed-old-2', sort_order: 2 },
        { team_id: teamId, user_id: 'pere', sort_order: 3 },
        { team_id: teamId, user_id: 'mitchel', sort_order: 4 },
        { team_id: teamId, user_id: 'pol', sort_order: 5 },
      ],
      new Set(approvedOrder),
    );

    expect(result.members.map(member => member.user_id)).toEqual(approvedOrder);
    expect(new Set(result.members.map(member => member.user_id)).size).toBe(6);
  });

  it('places current members without a weekly schedule after scheduled members', () => {
    const requested = ['kristian', 'unscheduled-a', 'melih', 'unscheduled-b'];
    const mixedMembers: Member[] = requested.map((user_id, sort_order) => ({
      team_id: teamId,
      user_id,
      sort_order,
      name: user_id,
    }));

    const result = buildEffectiveMemberOrder(
      mixedMembers,
      requested.map((user_id, sort_order) => ({ team_id: teamId, user_id, sort_order })),
      new Set(['kristian', 'melih']),
    );

    expect(result.members.map(member => member.user_id)).toEqual([
      'kristian',
      'melih',
      'unscheduled-a',
      'unscheduled-b',
    ]);
  });

  it('treats IT and Fin contrato as scheduled because they have a shift template assignment', () => {
    const result = buildEffectiveMemberOrder(
      [
        { team_id: teamId, user_id: 'it', sort_order: 0, name: 'IT' },
        { team_id: teamId, user_id: 'fin', sort_order: 1, name: 'Fin contrato' },
        { team_id: teamId, user_id: 'empty', sort_order: 2, name: 'Sin horario' },
      ],
      [
        { team_id: teamId, user_id: 'it', sort_order: 0 },
        { team_id: teamId, user_id: 'fin', sort_order: 1 },
        { team_id: teamId, user_id: 'empty', sort_order: 2 },
      ],
      new Set(['it', 'fin']),
    );

    expect(result.members.map(member => member.user_id)).toEqual(['it', 'fin', 'empty']);
  });
});
