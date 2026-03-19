import { useState } from 'react';
import { Check, X, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Member {
  id: string;
  user_id?: string;
  name: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string | null;
}

interface MultiAssigneeSelectProps {
  members: Member[];
  teams: Team[];
  selectedUserIds: string[];
  selectedTeamIds: string[];
  onChangeUsers: (userIds: string[]) => void;
  onChangeTeams: (teamIds: string[]) => void;
  disabled?: boolean;
}

export function MultiAssigneeSelect({
  members,
  teams,
  selectedUserIds,
  selectedTeamIds,
  onChangeUsers,
  onChangeTeams,
  disabled,
}: MultiAssigneeSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChangeUsers(selectedUserIds.filter(id => id !== userId));
    } else {
      onChangeUsers([...selectedUserIds, userId]);
    }
  };

  const toggleTeam = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      onChangeTeams(selectedTeamIds.filter(id => id !== teamId));
    } else {
      onChangeTeams([...selectedTeamIds, teamId]);
    }
  };

  const totalSelected = selectedUserIds.length + selectedTeamIds.length;

  const selectedMembers = members.filter(m => selectedUserIds.includes(m.user_id || m.id));
  const selectedTeams = teams.filter(t => selectedTeamIds.includes(t.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          className="w-full justify-start h-auto min-h-10 py-2"
        >
          {totalSelected === 0 ? (
            <span className="text-muted-foreground">Sin asignar</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedMembers.map(member => (
                <Badge key={member.user_id || member.id} variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {member.name || 'Sin nombre'}
                </Badge>
              ))}
              {selectedTeams.map(team => (
                <Badge 
                  key={team.id} 
                  variant="outline"
                  className="gap-1"
                  style={{ 
                    backgroundColor: `${team.color || '#888'}20`,
                    borderColor: team.color || undefined,
                    color: team.color || undefined 
                  }}
                >
                  <Users className="h-3 w-3" />
                  {team.name}
                </Badge>
              ))}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="max-h-96 overflow-y-auto overscroll-contain" onWheel={(e) => e.stopPropagation()}>
          <div className="p-2">
            {/* Users section */}
            <div className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Usuarios</span>
              </div>
              <div className="space-y-1">
                {members.map(member => {
                  const memberId = member.user_id || member.id;
                  const isSelected = selectedUserIds.includes(memberId);
                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => toggleUser(memberId)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted transition-colors text-sm text-foreground",
                        isSelected && "bg-muted"
                      )}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <span className="flex-1 text-left truncate">
                        {member.name || 'Sin nombre'}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    No hay usuarios
                  </p>
                )}
              </div>
            </div>

            {teams.length > 0 && (
              <>
                <Separator className="my-2" />
                
                {/* Teams section */}
                <div>
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase">Equipos</span>
                  </div>
                  <div className="space-y-1">
                    {teams.map(team => {
                      const isSelected = selectedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => toggleTeam(team.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted transition-colors text-sm text-foreground",
                            isSelected && "bg-muted"
                          )}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: team.color || undefined }}
                          />
                          <span className="flex-1 text-left truncate">{team.name}</span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {totalSelected > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1"
              onClick={() => {
                onChangeUsers([]);
                onChangeTeams([]);
              }}
            >
              <X className="h-4 w-4" />
              Limpiar selección
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
