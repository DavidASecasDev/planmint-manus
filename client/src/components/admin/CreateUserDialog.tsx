import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

type UserRole = 'admin' | 'manager' | 'member' | 'read_only';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: 'El email es obligatorio.',
  missing_name: 'El nombre es obligatorio.',
  invalid_password: 'La contraseña debe tener al menos 6 caracteres.',
  invalid_role: 'El rol seleccionado no es válido.',
  insufficient_permissions: 'No tienes permisos para crear usuarios.',
  already_member: 'Este usuario ya es miembro de tu organización.',
  creation_failed: 'Error al crear el usuario. Inténtalo de nuevo.',
  member_creation_failed: 'El usuario se creó pero no se pudo añadir a la organización.',
};

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await apiInvoke<{
        success: boolean;
        error?: string;
        message?: string;
        userId?: string;
        email?: string;
        name?: string;
        role?: string;
      }>('create-user', {
        body: {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        },
      });

      if (error) throw new Error(error.message);

      if (!data?.success) {
        const errCode = data?.error || 'unknown';
        const message = ERROR_MESSAGES[errCode] || data?.message || `Error: ${errCode}`;
        throw new Error(message);
      }

      toast.success('Usuario creado', {
        description: `${name.trim()} (${email.trim()}) ya puede iniciar sesión.`,
      });

      // Refresh the members list
      queryClient.invalidateQueries({ queryKey: ['org-members'] });

      handleClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Error', { description: error.message || 'No se pudo crear el usuario' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('member');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Crear usuario
          </DialogTitle>
          <DialogDescription>
            Crea un nuevo usuario que podrá iniciar sesión inmediatamente con las credenciales que definas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-user-name">Nombre completo</Label>
            <Input
              id="create-user-name"
              type="text"
              placeholder="Juan García"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-email">Email</Label>
            <Input
              id="create-user-email"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-password">Contraseña</Label>
            <div className="relative">
              <Input
                id="create-user-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              El usuario podrá cambiar su contraseña después de iniciar sesión.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Miembro</SelectItem>
                <SelectItem value="read_only">Solo lectura</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El rol determina los permisos iniciales del usuario
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !email.trim() || password.length < 6}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <UserPlus className="h-4 w-4 mr-2" />
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
