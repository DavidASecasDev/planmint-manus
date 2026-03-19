import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TransferStatusBadge } from './TransferStatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Users, Building2, User, Trash2, Euro } from 'lucide-react';
import type { TransferRequest } from '@/types/transfers';

interface TransferRequestCardProps {
  request: TransferRequest;
  onClick: () => void;
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}

export function TransferRequestCard({ request, onClick, onDelete, canDelete }: TransferRequestCardProps) {
  const formattedDate = request.first_transfer_date
    ? format(new Date(request.first_transfer_date), "d MMM yyyy", { locale: es })
    : 'Sin fecha';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm text-muted-foreground">
              {request.request_number}
            </span>
            <TransferStatusBadge status={request.status} />
          </div>
          
          <h3 className="font-semibold text-lg truncate">
            {request.client_name}
          </h3>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{request.broker_name}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{request.items_count || 0} transfer{(request.items_count || 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-2 shrink-0">
          {canDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar solicitud de transfer?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará la solicitud de transfer para <strong>{request.client_name}</strong> ({request.request_number}). Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(request.id);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <div className="text-right space-y-1">
            {request.is_external_provider ? (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="max-w-[150px] truncate">{request.external_provider_name || 'Externo'}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Interno</span>
            )}
            {request.total_amount != null && request.total_amount > 0 && (
              <div className="flex items-center justify-end gap-1 text-sm font-medium text-foreground">
                <Euro className="h-3.5 w-3.5" />
                <span>{(request.total_amount * 1.21).toFixed(2)} €</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
