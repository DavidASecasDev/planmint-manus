import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronDown, User, Users, Clock, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTeams } from '@/hooks/useTeams';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { useAvailableStaff } from '@/hooks/useAvailableStaff';

interface AssigneeSelectProps {
  userId: string | null;
  teamId: string | null;
  onChange: (userId: string | null, teamId: string | null) => void;
  disabled?: boolean;
  /** Optional: date in YYYY-MM-DD format to show shift availability */
  date?: string | null;
  /** Optional: time of the reservation in HH:MM format (e.g. "11:00").
   *  Used to determine who is on shift at that time instead of the current time. */
  reservationTime?: string | null;
}

interface Member {
  id: string;
  name: string | null;
}

/**
 * Parse a time string "HH:MM" into minutes since midnight.
 * Returns null if the string is invalid.
 */
function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

export function AssigneeSelect({ userId, teamId, onChange, disabled, date, reservationTime }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const { teams } = useTeams();
  const { members: orgMembers } = useOrganizationMembers();

  // Find the Directiva team ID
  const directivaTeamId = useMemo(() => {
    const dt = teams.find(t => t.name.toLowerCase().includes('directiva') || t.name.toLowerCase().includes('direcci'));
    return dt?.id || null;
  }, [teams]);

  // Fetch Directiva team members to exclude them from the assignee list
  const orgId = orgMembers[0]?.organization_id || null;
  const { data: directivaUserIds = [] } = useQuery({
    queryKey: ['directiva-members', directivaTeamId],
    queryFn: async (): Promise<string[]> => {
      if (!directivaTeamId) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', directivaTeamId);
      if (error) {
        console.error('Error fetching directiva members:', error);
        return [];
      }
      return (data || []).map(d => d.user_id);
    },
    enabled: !!directivaTeamId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // Filter to only active members, excluding Directiva, and map to the Member interface
  const members: Member[] = useMemo(() => {
    const directivaSet = new Set(directivaUserIds);
    return orgMembers
      .filter(m => m.status === 'active' && !directivaSet.has(m.user_id))
      .map(m => ({
        id: m.user_id,
        name: m.name || m.profile?.name || null,
      }));
  }, [orgMembers, directivaUserIds]);

  // Fetch staff availability for the given date
  const { data: availability = {} } = useAvailableStaff(date || null);

  // Determine the reference time in minutes:
  // If reservationTime is provided, use it; otherwise fall back to current time.
  const referenceMinutes = useMemo(() => {
    const parsed = parseTimeToMinutes(reservationTime);
    if (parsed !== null) return parsed;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, [reservationTime]);

  // Check if a user's shift covers the reference time
  const isOnShiftAtTime = useCallback((info: { available: boolean; start_time: string | null; end_time: string | null } | undefined): boolean => {
    if (!info || !info.available || !info.start_time || !info.end_time) return false;
    const startMin = parseTimeToMinutes(info.start_time);
    const endMin = parseTimeToMinutes(info.end_time);
    if (startMin === null || endMin === null) return false;
    // Handle overnight shifts (e.g. 22:00 - 06:00)
    if (endMin <= startMin) {
      return referenceMinutes >= startMin || referenceMinutes <= endMin;
    }
    return referenceMinutes >= startMin && referenceMinutes <= endMin;
  }, [referenceMinutes]);

  // Sort members: on shift at reservation time first, then others
  const sortedMembers = useMemo(() => {
    if (!date) return members; // No date = no sorting by availability

    return [...members].sort((a, b) => {
      const aInfo = availability[a.id];
      const bInfo = availability[b.id];

      // Priority: on shift at time (0) > has shift but not at time (1) > unscheduled (2) > day-off (3)
      const getPriority = (info: typeof aInfo) => {
        if (!info) return 2; // unscheduled
        if (!info.available) return 3; // day off
        if (isOnShiftAtTime(info)) return 0; // on shift at reservation time
        return 1; // shift assigned but not at this time
      };

      const diff = getPriority(aInfo) - getPriority(bInfo);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members, availability, date, isOnShiftAtTime]);

  const selectedUser = members.find(m => m.id === userId);
  const selectedTeam = teams.find(t => t.id === teamId);

  const handleSelectUser = (id: string) => {
    if (userId === id) {
      onChange(null, teamId);
    } else {
      onChange(id, null); // Clear team when selecting user
    }
    setOpen(false);
  };

  const handleSelectTeam = (id: string) => {
    if (teamId === id) {
      onChange(userId, null);
    } else {
      onChange(null, id); // Clear user when selecting team
    }
    setOpen(false);
  };

  const displayValue = selectedUser?.name || selectedTeam?.name || null;

  // Show shift info for selected user
  const selectedUserShift = userId && date ? availability[userId] : null;

  // Label for the section header
  const onShiftLabel = reservationTime
    ? `En turno a las ${reservationTime}`
    : 'En turno ahora';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-7 px-2 justify-between min-w-[100px] hover:bg-muted/50"
        >
          {displayValue ? (
            <span className="flex items-center gap-1 text-xs truncate">
              {selectedTeam ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {displayValue}
              {selectedUserShift && (
                <span className={cn(
                  "ml-1 text-[10px] px-1 py-0.5 rounded",
                  selectedUserShift.available
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {selectedUserShift.available
                    ? (selectedUserShift.start_time?.slice(0, 5) || '')
                    : 'Libre'}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="max-h-72 overflow-auto">
          {sortedMembers.length > 0 && (
            <>
              {(() => {
                if (!date) {
                  // No date context: show flat list without shift info
                  return (
                    <>
                      <p className="text-xs text-muted-foreground px-2 py-1 font-medium">Usuarios</p>
                      {sortedMembers.map((member) => (
                        <button
                          key={member.id}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                            userId === member.id && "bg-muted"
                          )}
                          onClick={() => handleSelectUser(member.id)}
                        >
                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1 text-left">{member.name || 'Sin nombre'}</span>
                          {userId === member.id && (
                            <Check className="h-3 w-3 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </>
                  );
                }

                // Split members into groups
                const onShiftAtTime: typeof sortedMembers = [];
                const notOnShiftAtTime: typeof sortedMembers = [];
                const unscheduled: typeof sortedMembers = [];
                const dayOff: typeof sortedMembers = [];

                for (const member of sortedMembers) {
                  const info = availability[member.id];
                  if (!info) {
                    unscheduled.push(member);
                  } else if (!info.available) {
                    dayOff.push(member);
                  } else if (isOnShiftAtTime(info)) {
                    onShiftAtTime.push(member);
                  } else {
                    notOnShiftAtTime.push(member);
                  }
                }

                const renderMember = (member: typeof sortedMembers[0], dimmed: boolean) => {
                  const info = availability[member.id];
                  const onShift = info ? isOnShiftAtTime(info) : false;
                  const isDayOffMember = info && !info.available;
                  const isNotOnShiftMember = info && info.available && !onShift;

                  return (
                    <button
                      key={member.id}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                        userId === member.id && "bg-muted",
                        dimmed && "opacity-40"
                      )}
                      onClick={() => handleSelectUser(member.id)}
                    >
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{member.name || 'Sin nombre'}</span>
                      {info && info.available && onShift && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {info.start_time?.slice(0, 5)}–{info.end_time?.slice(0, 5)}
                        </span>
                      )}
                      {isNotOnShiftMember && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0 line-through">
                          <Clock className="h-2.5 w-2.5" />
                          {info.start_time?.slice(0, 5)}–{info.end_time?.slice(0, 5)}
                        </span>
                      )}
                      {isDayOffMember && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                          <Moon className="h-2.5 w-2.5" />
                          Libre
                        </span>
                      )}
                      {userId === member.id && (
                        <Check className="h-3 w-3 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  );
                };

                return (
                  <>
                    {/* On shift at reservation time */}
                    {onShiftAtTime.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {onShiftLabel}
                        </p>
                        {onShiftAtTime.map((m) => renderMember(m, false))}
                      </>
                    )}

                    {/* Separator between on-shift and others */}
                    {onShiftAtTime.length > 0 && (notOnShiftAtTime.length > 0 || unscheduled.length > 0 || dayOff.length > 0) && (
                      <div className="my-1 mx-2 border-t border-border" />
                    )}

                    {/* Not on shift at this time */}
                    {notOnShiftAtTime.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium opacity-60">
                          Fuera de turno
                        </p>
                        {notOnShiftAtTime.map((m) => renderMember(m, true))}
                      </>
                    )}

                    {/* Unscheduled */}
                    {unscheduled.length > 0 && (
                      <>
                        {(onShiftAtTime.length > 0 || notOnShiftAtTime.length > 0) && (
                          <div className="my-1 mx-2 border-t border-border" />
                        )}
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium opacity-60">
                          Sin turno asignado
                        </p>
                        {unscheduled.map((m) => renderMember(m, true))}
                      </>
                    )}

                    {/* Day off */}
                    {dayOff.length > 0 && (
                      <>
                        {(onShiftAtTime.length > 0 || notOnShiftAtTime.length > 0 || unscheduled.length > 0) && (
                          <div className="my-1 mx-2 border-t border-border" />
                        )}
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium opacity-60">
                          Día libre
                        </p>
                        {dayOff.map((m) => renderMember(m, true))}
                      </>
                    )}
                  </>
                );
              })()}
            </>
          )}
          {teams.filter(t => t.id !== directivaTeamId).length > 0 && (
            <>
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium mt-2">
                Equipos
              </p>
              {teams.filter(t => t.id !== directivaTeamId).map((team) => (
                <button
                  key={team.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                    teamId === team.id && "bg-muted"
                  )}
                  onClick={() => handleSelectTeam(team.id)}
                >
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{team.name}</span>
                  {teamId === team.id && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </button>
              ))}
            </>
          )}
          {members.length === 0 && teams.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              Sin asignados disponibles
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
