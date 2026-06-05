import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  userEmail: string;
  onConfirm: () => void;
  isLoading: boolean;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  userName,
  userEmail,
  onConfirm,
  isLoading,
}: DeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmText('');
    }
    onOpenChange(isOpen);
  };

  const confirmTarget = userEmail || userName;
  const isConfirmed = confirmText === confirmTarget;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Eliminar usuario permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Estás a punto de eliminar completamente al usuario <strong>{userName}</strong> ({userEmail}) del sistema.
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
              <p className="font-medium text-destructive">Esta acción es irreversible y eliminará:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>La cuenta de autenticación (no podrá volver a iniciar sesión)</li>
                <li>El perfil del usuario</li>
                <li>Todas sus membresías en organizaciones</li>
                <li>Todos sus permisos personalizados</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-delete" className="text-sm">
            Escribe <strong className="text-destructive">{confirmTarget}</strong> para confirmar:
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmTarget}
            className="border-destructive/30 focus-visible:ring-destructive/30"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!isConfirmed || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar usuario'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
