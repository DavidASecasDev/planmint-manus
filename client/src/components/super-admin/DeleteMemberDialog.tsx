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
import { UserMinus } from 'lucide-react';

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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <UserMinus className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>Eliminar Miembro</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            ¿Estás seguro de que quieres eliminar a <strong>{memberName}</strong> de <strong>{orgName}</strong>?
            <br /><br />
            Esta acción no se puede deshacer. El usuario perderá acceso a todos los datos de la organización.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Eliminando...' : 'Eliminar Miembro'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
