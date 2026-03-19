import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Users, Pencil, Trash2 } from 'lucide-react';
import { Team } from '@/hooks/useTeams';

interface TeamCardProps {
  team: Team;
  canManage: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TeamCard({ team, canManage, onClick, onEdit, onDelete }: TeamCardProps) {
  return (
    <Card
      className="hover:border-primary/50 cursor-pointer transition-colors"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Equipo: ${team.name}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" style={{ backgroundColor: team.color || undefined }}>
              <AvatarFallback className="text-white font-semibold">
                {team.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{team.name}</CardTitle>
              {team.description && (
                <CardDescription className="text-sm mt-0.5 line-clamp-1">
                  {team.description}
                </CardDescription>
              )}
            </div>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            {team.member_count || 0} {team.member_count === 1 ? 'miembro' : 'miembros'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
