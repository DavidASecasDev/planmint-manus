import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserPlus, Copy, Check, Mail } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';

type InviteRole = 'admin' | 'manager' | 'member' | 'read_only';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Error messages for known error codes from the backend */
const ERROR_MESSAGES: Record<string, string> = {
  missing_email: 'El email es obligatorio.',
  invalid_role: 'El rol seleccionado no es válido.',
  insufficient_permissions: 'No tienes permisos para invitar miembros. Solo los propietarios y administradores pueden hacerlo.',
  already_member: 'Este usuario ya es miembro de tu organización.',
  invitation_already_exists: 'Ya existe una invitación pendiente para este email.',
  insert_failed: 'Error al guardar la invitación. Inténtalo de nuevo.',
};

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await apiInvoke<{
        success: boolean;
        error?: string;
        token?: string;
        expires_at?: string;
      }>('create-invitation', {
        body: {
          p_email: email.trim(),
          p_role: role,
          p_expires_in_days: 7,
        },
      });

      if (error) throw new Error(error.message);

      if (!data?.success) {
        const errCode = data?.error || 'unknown';
        const message = ERROR_MESSAGES[errCode] || `Error al crear invitación: ${errCode}`;
        throw new Error(message);
      }

      const link = `${window.location.origin}/auth/invitation/${data.token}`;
      setInviteLink(link);
      toast.success('Invitación creada', { description: `Se ha generado el enlace de invitación para ${email}` });
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast.error('Error', { description: error.message || 'No se pudo crear la invitación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail('');
    setRole('member');
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  const roleLabels: Record<InviteRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    member: 'Miembro',
    read_only: 'Solo lectura',
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // IMPORTANT: don't auto-close when opening
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
            Invitar miembro
          </DialogTitle>
          <DialogDescription>
            Envía una invitación para que un nuevo miembro se una a tu organización
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as InviteRole)} disabled={isSubmitting}>
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
                El rol determina los permisos iniciales del miembro
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !email.trim()}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                Crear invitación
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Invitación creada para <strong>{email}</strong> como <strong>{roleLabels[role]}</strong>.
                Comparte el enlace siguiente:
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              El enlace expira en 7 días. Solo se puede usar una vez.
            </p>

            <DialogFooter>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
