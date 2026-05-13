import { useState, useMemo, useCallback } from 'react';
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
}

interface Member {
  id: string;
  name: string | null;
}

export function AssigneeSelect({ userId, teamId, onChange, disabled, date }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const { teams } = useTeams();
  const { members: orgMembers } = useOrganizationMembers();

  // Filter to only active members and map to the Member interface
  const members: Member[] = useMemo(() => {
    return orgMembers
      .filter(m => m.status === 'active')
      .map(m => ({
        id: m.user_id,
        name: m.name || m.profile?.name || null,
      }));
  }, [orgMembers]);

  // Fetch staff availability for the given date
  const { data: availability = {} } = useAvailableStaff(date || null);

  // Check if a user is currently on shift (their shift window includes the current time)
  const isCurrentlyOnShift = useCallback((info: { available: boolean; start_time: string | null; end_time: string | null } | undefined): boolean => {
    if (!info || !info.available || !info.start_time || !info.end_time) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = info.start_time.split(':').map(Number);
    const [eh, em] = info.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    // Handle overnight shifts (e.g. 22:00 - 06:00)
    if (endMin <= startMin) {
      return currentMinutes >= startMin || currentMinutes <= endMin;
    }
    return currentMinutes >= startMin && currentMinutes <= endMin;
  }, []);

  // Sort members: currently on shift first, then upcoming/ended shift, then unscheduled, then day-off
  const sortedMembers = useMemo(() => {
    if (!date) return members; // No date = no sorting by availability

    return [...members].sort((a, b) => {
      const aInfo = availability[a.id];
      const bInfo = availability[b.id];

      // Priority: currently on shift (0) > has shift but not now (1) > unscheduled (2) > day-off (3)
      const getPriority = (info: typeof aInfo) => {
        if (!info) return 2; // unscheduled
        if (!info.available) return 3; // day off
        if (isCurrentlyOnShift(info)) return 0; // currently working
        return 1; // shift assigned but not current
      };

      const diff = getPriority(aInfo) - getPriority(bInfo);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members, availability, date, isCurrentlyOnShift]);

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
                const onShiftNow: typeof sortedMembers = [];
                const shiftEndedOrNotStarted: typeof sortedMembers = [];
                const unscheduled: typeof sortedMembers = [];
                const dayOff: typeof sortedMembers = [];

                for (const member of sortedMembers) {
                  const info = availability[member.id];
                  if (!info) {
                    unscheduled.push(member);
                  } else if (!info.available) {
                    dayOff.push(member);
                  } else if (isCurrentlyOnShift(info)) {
                    onShiftNow.push(member);
                  } else {
                    shiftEndedOrNotStarted.push(member);
                  }
                }

                const renderMember = (member: typeof sortedMembers[0], dimmed: boolean) => {
                  const info = availability[member.id];
                  const onShift = info ? isCurrentlyOnShift(info) : false;
                  const isDayOffMember = info && !info.available;
                  const isEndedMember = info && info.available && !onShift;

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
                      {isEndedMember && (
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
                    {/* Currently on shift */}
                    {onShiftNow.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          En turno ahora
                        </p>
                        {onShiftNow.map((m) => renderMember(m, false))}
                      </>
                    )}

                    {/* Separator between on-shift and others */}
                    {onShiftNow.length > 0 && (shiftEndedOrNotStarted.length > 0 || unscheduled.length > 0 || dayOff.length > 0) && (
                      <div className="my-1 mx-2 border-t border-border" />
                    )}

                    {/* Shift ended / not started */}
                    {shiftEndedOrNotStarted.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground px-2 py-1 font-medium opacity-60">
                          Fuera de turno
                        </p>
                        {shiftEndedOrNotStarted.map((m) => renderMember(m, true))}
                      </>
                    )}

                    {/* Unscheduled */}
                    {unscheduled.length > 0 && (
                      <>
                        {(onShiftNow.length > 0 || shiftEndedOrNotStarted.length > 0) && (
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
                        {(onShiftNow.length > 0 || shiftEndedOrNotStarted.length > 0 || unscheduled.length > 0) && (
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
          {teams.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium mt-2">
                Equipos
              </p>
              {teams.map((team) => (
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
