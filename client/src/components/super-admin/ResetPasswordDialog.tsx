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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Key } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onConfirm: (newPassword: string) => void;
  isLoading: boolean;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
  isLoading,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
    onOpenChange(isOpen);
  };

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = newPassword.length >= 6 && passwordsMatch;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Resetear Contraseña
          </DialogTitle>
          <DialogDescription>
            Establece una nueva contraseña para <strong>{userName}</strong>.
            El usuario deberá usar esta contraseña en su próximo inicio de sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-xs text-destructive">La contraseña debe tener al menos 6 caracteres</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(newPassword)} disabled={!isValid || isLoading}>
            {isLoading ? 'Actualizando...' : 'Cambiar contraseña'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
