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
import { UserMinus, AlertTriangle } from 'lucide-react';

interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  orgName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  memberName,
  orgName,
  onConfirm,
  isLoading,
}: DeleteMemberDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const confirmWord = 'ELIMINAR';
  const isConfirmed = confirmText === confirmWord;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmText('');
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar Miembro</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left" asChild>
            <div>
              <p className="mb-3">
                Estás a punto de eliminar a <strong className="text-foreground">{memberName}</strong> de <strong className="text-foreground">{orgName}</strong>.
              </p>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <strong>Consecuencias de esta acción:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>El usuario perderá acceso inmediato a {orgName}</li>
                    <li>No podrá ver tareas, áreas ni datos de la organización</li>
                    <li>Las tareas asignadas a este usuario quedarán sin asignar</li>
                    <li>Se perderá el historial de actividad del miembro</li>
                    <li>Las notificaciones pendientes de la org dejarán de llegarle</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Para confirmar, escribe <strong className="text-foreground font-mono">{confirmWord}</strong>
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escribe ELIMINAR para confirmar"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!isConfirmed || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar Miembro'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
