import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useOrganizationMembers, OrganizationMember } from '@/hooks/usePermissions';
import { TeamMember } from '@/hooks/useTeams';

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMembers: TeamMember[];
  onAdd: (userId: string) => void;
  isLoading?: boolean;
}

export function AddTeamMemberDialog({ open, onOpenChange, currentMembers, onAdd, isLoading }: AddTeamMemberDialogProps) {
  const { members: orgMembers, isLoading: loadingOrgMembers } = useOrganizationMembers();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const currentMemberIds = useMemo(
    () => new Set(currentMembers.map(m => m.user_id)),
    [currentMembers]
  );

  const availableMembers = useMemo(() => {
    return orgMembers
      .filter(m => !currentMemberIds.has(m.user_id) && m.status === 'active')
      .filter(m => {
        if (!search) return true;
        const name = m.profile?.name?.toLowerCase() || '';
        return name.includes(search.toLowerCase());
      });
  }, [orgMembers, currentMemberIds, search]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAdd = () => {
    if (selectedUserId) {
      onAdd(selectedUserId);
      setSelectedUserId(null);
      setSearch('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir miembro al equipo</DialogTitle>
          <DialogDescription>
            Selecciona un miembro de tu organización para añadirlo a este equipo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar miembro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingOrgMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No se encontraron miembros' : 'Todos los miembros ya están en el equipo'}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {availableMembers.map((member) => (
                <div
                  key={member.user_id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUserId === member.user_id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                  onClick={() => setSelectedUserId(member.user_id)}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(member.profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{member.profile?.name || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                  {selectedUserId === member.user_id && (
                    <div className="h-4 w-4 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={!selectedUserId || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <UserPlus className="h-4 w-4 mr-2" />
            Añadir al equipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
