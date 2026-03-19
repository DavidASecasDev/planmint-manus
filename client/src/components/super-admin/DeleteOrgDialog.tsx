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
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteOrgDialog({
  open,
  onOpenChange,
  orgName,
  onConfirm,
  isLoading,
}: DeleteOrgDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const isConfirmed = confirmText === orgName;

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
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar Organización</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive">
                <strong>¡Peligro!</strong> Esta acción es irreversible y eliminará permanentemente:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Todos los miembros</li>
                  <li>Todas las tareas</li>
                  <li>Todas las áreas</li>
                  <li>Toda la suscripción</li>
                  <li>Todos los datos asociados</li>
                </ul>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>
                Para confirmar, escribe <strong className="text-foreground">{orgName}</strong>
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Nombre de la organización"
                className="font-mono"
              />
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
            {isLoading ? 'Eliminando...' : 'Eliminar Permanentemente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
