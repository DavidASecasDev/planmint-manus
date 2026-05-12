import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  orgName: string;
  existingMemberIds: string[];
  onConfirm: (userId: string, userName: string, role: string) => void;
  isLoading?: boolean;
}

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Miembro' },
  { value: 'read_only', label: 'Solo lectura' },
];

export function AddMemberDialog({
  open,
  onOpenChange,
  organizationId,
  orgName,
  existingMemberIds,
  onConfirm,
  isLoading,
}: AddMemberDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');

  // Fetch all profiles (users registered in the platform)
  const { data: allProfiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['all-profiles-for-add-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, organization_id')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  // Filter out users who are already members of this org
  const availableUsers = useMemo(() => {
    const existingSet = new Set(existingMemberIds);
    return allProfiles.filter((p) => !existingSet.has(p.id));
  }, [allProfiles, existingMemberIds]);

  // Filter by search term
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return availableUsers;
    const term = search.toLowerCase();
    return availableUsers.filter(
      (p) => p.name?.toLowerCase().includes(term)
    );
  }, [availableUsers, search]);

  const handleSelect = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
  };

  const handleConfirm = () => {
    if (!selectedUserId) return;
    onConfirm(selectedUserId, selectedUserName, selectedRole);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSearch('');
      setSelectedUserId(null);
      setSelectedUserName('');
      setSelectedRole('member');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Añadir miembro a {orgName}
          </DialogTitle>
          <DialogDescription>
            Busca un usuario registrado en la plataforma y asígnale un rol en esta organización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User list */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[200px]">
              {loadingProfiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search ? 'No se encontraron usuarios' : 'No hay usuarios disponibles para añadir'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelect(user.id, user.name || 'Sin nombre')}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        selectedUserId === user.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0">
                        {(user.name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground truncate">ID: {user.id.slice(0, 8)}...</p>
                      </div>
                      {selectedUserId === user.id && (
                        <Badge variant="default" className="shrink-0">Seleccionado</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Role selection */}
          {selectedUserId && (
            <div className="space-y-2">
              <Label>Rol para {selectedUserName}</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedUserId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Añadiendo...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Añadir miembro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
