import { useState, useMemo } from 'react';
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

  // Sort members: available first, then unscheduled, then day-off
  const sortedMembers = useMemo(() => {
    if (!date) return members; // No date = no sorting by availability

    return [...members].sort((a, b) => {
      const aInfo = availability[a.id];
      const bInfo = availability[b.id];

      // Priority: available (0) > unscheduled (1) > day-off (2)
      const getPriority = (info: typeof aInfo) => {
        if (!info) return 1; // unscheduled
        if (info.available) return 0; // working
        return 2; // day off
      };

      const diff = getPriority(aInfo) - getPriority(bInfo);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members, availability, date]);

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
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
                Usuarios
                {date && (
                  <span className="ml-1 text-[10px] opacity-70">
                    (turno del día)
                  </span>
                )}
              </p>
              {sortedMembers.map((member) => {
                const shiftInfo = date ? availability[member.id] : null;
                const isDayOff = shiftInfo && !shiftInfo.available;
                const isWorking = shiftInfo && shiftInfo.available;

                return (
                  <button
                    key={member.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                      userId === member.id && "bg-muted",
                      isDayOff && "opacity-50"
                    )}
                    onClick={() => handleSelectUser(member.id)}
                  >
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{member.name || 'Sin nombre'}</span>
                    {/* Shift badge */}
                    {isWorking && (
                      <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {shiftInfo.start_time?.slice(0, 5)}–{shiftInfo.end_time?.slice(0, 5)}
                      </span>
                    )}
                    {isDayOff && (
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
              })}
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
