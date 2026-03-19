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
import { Ban, CheckCircle } from 'lucide-react';

interface SuspendOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  currentStatus: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function SuspendOrgDialog({
  open,
  onOpenChange,
  orgName,
  currentStatus,
  onConfirm,
  isLoading,
}: SuspendOrgDialogProps) {
  const isSuspending = currentStatus !== 'suspended';
  const Icon = isSuspending ? Ban : CheckCircle;
  const iconBg = isSuspending ? 'bg-orange-500/10' : 'bg-green-500/10';
  const iconColor = isSuspending ? 'text-orange-600' : 'text-green-600';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`h-10 w-10 rounded-full ${iconBg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <AlertDialogTitle>
              {isSuspending ? 'Suspender Organización' : 'Reactivar Organización'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {isSuspending ? (
              <>
                ¿Estás seguro de que quieres suspender <strong>{orgName}</strong>?
                <br /><br />
                Los miembros no podrán acceder a la organización mientras esté suspendida.
                Puedes reactivarla en cualquier momento.
              </>
            ) : (
              <>
                ¿Quieres reactivar <strong>{orgName}</strong>?
                <br /><br />
                Los miembros podrán acceder nuevamente a la organización.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={isSuspending ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isLoading 
              ? (isSuspending ? 'Suspendiendo...' : 'Reactivando...') 
              : (isSuspending ? 'Suspender' : 'Reactivar')
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
