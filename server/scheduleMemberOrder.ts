export interface ScheduleTeamMember {
  team_id: string;
  user_id: string;
  sort_order: number;
  [key: string]: unknown;
}

export interface WeeklyMemberOrderRow {
  team_id: string;
  user_id: string;
  sort_order: number;
  created_at?: string | null;
}

export interface MemberOrderValidation {
  member_count: number;
  displayed_count: number;
  sequence_valid: boolean;
}

export interface EffectiveMemberOrderResult<T extends ScheduleTeamMember> {
  members: T[];
  customTeamIds: string[];
  validationByTeam: Record<string, MemberOrderValidation>;
}

function compareStoredOrder(a: WeeklyMemberOrderRow, b: WeeklyMemberOrderRow): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  const created = String(a.created_at || '').localeCompare(String(b.created_at || ''));
  if (created !== 0) return created;
  return a.user_id.localeCompare(b.user_id);
}

/**
 * Resolves the visible row order for every team and week.
 *
 * Rules:
 * - A valid weekly row outranks global/team creation order.
 * - Weekly rows for removed members are ignored.
 * - Current members missing from a legacy/partial weekly order are appended.
 * - Members with any assigned shift template in the week stay before members
 *   without a schedule; IT and Fin contrato count because they are templates.
 * - Every returned team receives a contiguous, unique 0..n-1 sequence.
 */
export function buildEffectiveMemberOrder<T extends ScheduleTeamMember>(
  teamMembers: T[],
  weeklyOrder: WeeklyMemberOrderRow[],
  scheduledUserIds: ReadonlySet<string>,
): EffectiveMemberOrderResult<T> {
  const membersByTeam = new Map<string, T[]>();
  for (const member of teamMembers) {
    const teamMembersForId = membersByTeam.get(member.team_id) || [];
    if (!teamMembersForId.some(existing => existing.user_id === member.user_id)) {
      teamMembersForId.push(member);
    }
    membersByTeam.set(member.team_id, teamMembersForId);
  }

  const weeklyByTeam = new Map<string, WeeklyMemberOrderRow[]>();
  for (const row of weeklyOrder) {
    const rows = weeklyByTeam.get(row.team_id) || [];
    rows.push(row);
    weeklyByTeam.set(row.team_id, rows);
  }

  const members: T[] = [];
  const customTeamIds: string[] = [];
  const validationByTeam: Record<string, MemberOrderValidation> = {};

  for (const teamId of Array.from(membersByTeam.keys())) {
    const currentMembers = membersByTeam.get(teamId) as T[];
    const currentIds = new Set(currentMembers.map((member: T) => member.user_id));
    const storedRows = (weeklyByTeam.get(teamId) || [])
      .filter(row => currentIds.has(row.user_id))
      .sort(compareStoredOrder);

    const orderedIds: string[] = [];
    for (const row of storedRows) {
      if (!orderedIds.includes(row.user_id)) orderedIds.push(row.user_id);
    }
    for (const member of currentMembers) {
      if (!orderedIds.includes(member.user_id)) orderedIds.push(member.user_id);
    }

    const requestedPosition = new Map(orderedIds.map((userId, index) => [userId, index]));
    const effectiveIds = [...orderedIds].sort((a, b) => {
      const aScheduled = scheduledUserIds.has(a) ? 0 : 1;
      const bScheduled = scheduledUserIds.has(b) ? 0 : 1;
      if (aScheduled !== bScheduled) return aScheduled - bScheduled;
      return (requestedPosition.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (requestedPosition.get(b) ?? Number.MAX_SAFE_INTEGER);
    });

    const byUserId = new Map<string, T>(currentMembers.map((member: T) => [member.user_id, member]));
    effectiveIds.forEach((userId, index) => {
      const member = byUserId.get(userId);
      if (member) members.push({ ...member, sort_order: index } as T);
    });

    if (storedRows.length > 0) customTeamIds.push(teamId);
    validationByTeam[teamId] = {
      member_count: currentMembers.length,
      displayed_count: effectiveIds.length,
      sequence_valid:
        effectiveIds.length === currentMembers.length &&
        new Set(effectiveIds).size === currentMembers.length,
    };
  }

  return { members, customTeamIds, validationByTeam };
}
