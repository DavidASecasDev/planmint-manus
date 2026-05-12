import { useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, UserPlus } from 'lucide-react';
import { usePlatformOrganizations } from '@/hooks/useSuperAdmin';
import { useQuery } from '@tanstack/react-query';
import { apiInvoke } from '@/lib/apiClient';

interface AddUserToOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onConfirm: (organizationId: string, orgName: string, role: string) => void;
  isLoading?: boolean;
}

interface MembershipData {
  id: string;
  organization_id: string;
  role: string;
  status: string;
  created_at: string;
  organization: { id: string; name: string } | null;
}

export function AddUserToOrgDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onConfirm,
  isLoading,
}: AddUserToOrgDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');

  const { data: organizations } = usePlatformOrganizations();

  // Fetch user's current memberships to filter out orgs they're already in
  const { data: memberships } = useQuery({
    queryKey: ['user-memberships', userId],
    queryFn: async () => {
      const { data, error } = await apiInvoke<{ data: MembershipData[]; error: null }>('super-admin/get-user-memberships', {
        body: { userId },
      });
      if (error) throw new Error(error.message);
      // apiInvoke wraps the response body, so data is { data: [...], error: null }
      return (data as any)?.data || data || [];
    },
    enabled: open && !!userId,
  });

  const existingOrgIds = useMemo(() => {
    return new Set((memberships || [] as MembershipData[])
      .filter((m: MembershipData) => m.status === 'active')
      .map((m: MembershipData) => m.organization_id));
  }, [memberships]);

  const filteredOrgs = useMemo(() => {
    return (organizations || []).filter(org => {
      const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase());
      const notAlreadyMember = !existingOrgIds.has(org.id);
      return matchesSearch && notAlreadyMember;
    });
  }, [organizations, searchQuery, existingOrgIds]);

  const selectedOrg = organizations?.find(o => o.id === selectedOrgId);

  const handleConfirm = () => {
    if (selectedOrgId && selectedOrg) {
      onConfirm(selectedOrgId, selectedOrg.name, selectedRole);
      // Reset state
      setSelectedOrgId(null);
      setSelectedRole('member');
      setSearchQuery('');
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedOrgId(null);
      setSelectedRole('member');
      setSearchQuery('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Añadir {userName} a organización
          </DialogTitle>
          <DialogDescription>
            Selecciona una organización y un rol para asignar al usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organización..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Organization list */}
          <div className="max-h-[200px] overflow-y-auto border rounded-lg">
            {filteredOrgs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No se encontraron organizaciones' : 'Ya es miembro de todas las organizaciones'}
              </div>
            ) : (
              filteredOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0 ${
                    selectedOrgId === org.id ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {org.memberCount || 0} miembros
                    </p>
                  </div>
                  {selectedOrgId === org.id && (
                    <Badge variant="secondary">Seleccionado</Badge>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Role selector */}
          {selectedOrgId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Rol para {userName} en {selectedOrg?.name}
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Miembro</SelectItem>
                  <SelectItem value="read_only">Solo lectura</SelectItem>
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
            disabled={!selectedOrgId || isLoading}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Añadir a organización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
