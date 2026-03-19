import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UserCog } from 'lucide-react';

interface ChangeMemberRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRole: string;
  onConfirm: (newRole: string) => void;
  isLoading?: boolean;
}

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Control total de la organización' },
  { value: 'admin', label: 'Admin', description: 'Gestión completa excepto billing' },
  { value: 'manager', label: 'Manager', description: 'Gestión de tareas y equipo' },
  { value: 'member', label: 'Miembro', description: 'Crear y editar tareas' },
];

export function ChangeMemberRoleDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  onConfirm,
  isLoading,
}: ChangeMemberRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState(currentRole);

  const handleConfirm = () => {
    if (selectedRole !== currentRole) {
      onConfirm(selectedRole);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Cambiar Rol</DialogTitle>
          </div>
          <DialogDescription>
            Cambia el rol de <strong>{memberName}</strong> en la organización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nuevo rol</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{role.label}</span>
                      <span className="text-xs text-muted-foreground">{role.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || selectedRole === currentRole}>
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
