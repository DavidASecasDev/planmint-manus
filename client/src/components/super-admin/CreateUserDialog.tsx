import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { apiInvoke } from '@/lib/apiClient';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: {
    email: string;
    password: string;
    name: string;
    organizationId?: string;
    role?: string;
  }) => void;
  isLoading: boolean;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState<string>('none');
  const [role, setRole] = useState('member');
  const [showPassword, setShowPassword] = useState(false);

  // Fetch organizations for the dropdown
  const { data: organizations } = useQuery({
    queryKey: ['all-organizations-for-create-user'],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from<{ id: string; name: string }[]>('organizations')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setName('');
      setOrganizationId('none');
      setRole('member');
      setShowPassword(false);
    }
    onOpenChange(isOpen);
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValid = isValidEmail && password.length >= 6 && name.trim().length > 0;

  const handleSubmit = () => {
    onConfirm({
      email,
      password,
      name: name.trim(),
      organizationId: organizationId !== 'none' ? organizationId : undefined,
      role,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Crear Nuevo Usuario
          </DialogTitle>
          <DialogDescription>
            Crea un usuario directamente en el sistema. El email se confirmará automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Nombre</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
            />
            {email.length > 0 && !isValidEmail && (
              <p className="text-xs text-destructive">Email no válido</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">Contraseña</Label>
            <div className="relative">
              <Input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-destructive">La contraseña debe tener al menos 6 caracteres</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organización (opcional)</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin organización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin organización</SelectItem>
                  {organizations?.map((org: { id: string; name: string }) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? 'Creando...' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
