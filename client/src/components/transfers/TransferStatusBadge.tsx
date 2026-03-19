import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TransferRequestStatus, TransferItemStatus, TRANSFER_REQUEST_STATUS_META, TRANSFER_ITEM_STATUS_META } from '@/types/transfers';

const REQUEST_STATUS_META: Record<TransferRequestStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  en_gestion: { label: 'En gestión', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  presupuesto_enviado: { label: 'Ppto. Enviado', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  completado: { label: 'Completado', color: 'bg-primary/10 text-primary border-primary/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const ITEM_STATUS_META: Record<TransferItemStatus, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  confirmado: { label: 'Confirmado', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  completado: { label: 'Completado', color: 'bg-primary/10 text-primary border-primary/20' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface TransferStatusBadgeProps {
  status: TransferRequestStatus | TransferItemStatus;
  type?: 'request' | 'item';
  className?: string;
}

export function TransferStatusBadge({ status, type = 'request', className }: TransferStatusBadgeProps) {
  const meta = type === 'request' 
    ? REQUEST_STATUS_META[status as TransferRequestStatus]
    : ITEM_STATUS_META[status as TransferItemStatus];

  return (
    <Badge 
      variant="outline" 
      className={cn('text-xs font-medium border', meta?.color, className)}
    >
      {meta?.label || status}
    </Badge>
  );
}
