import { useState } from 'react';
import { Check, ChevronDown, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface AssigneeSelectProps {
  userId: string | null;
  teamId: string | null;
  onChange: (userId: string | null, teamId: string | null) => void;
  disabled?: boolean;
}

interface Member {
  id: string;
  name: string | null;
}

export function AssigneeSelect({ userId, teamId, onChange, disabled }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const { teams } = useTeams();
  const { profile } = useAuth();

  const { data: members = [] } = useQuery({
    queryKey: ['org-members', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('organization_id', profile.organization_id);
      
      if (error) throw error;
      return data as Member[];
    },
    enabled: !!profile?.organization_id,
  });

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
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-64 overflow-auto">
          {members.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium">
                Usuarios
              </p>
              {members.map((member) => (
                <button
                  key={member.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                    userId === member.id && "bg-muted"
                  )}
                  onClick={() => handleSelectUser(member.id)}
                >
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{member.name || 'Sin nombre'}</span>
                  {userId === member.id && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </button>
              ))}
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
