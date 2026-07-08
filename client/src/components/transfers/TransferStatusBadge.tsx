import { Badge } from '@/components/ui/badge';
import { TRANSFER_REQUEST_STATUS_META, TRANSFER_ITEM_STATUS_META } from '@/types/transfers';
import type { TransferRequestStatus, TransferItemStatus } from '@/types/transfers';

interface Props {
  status: TransferRequestStatus | TransferItemStatus;
  variant?: 'request' | 'item';
  className?: string;
}

export function TransferStatusBadge({ status, variant = 'request', className = '' }: Props) {
  const meta = variant === 'request'
    ? TRANSFER_REQUEST_STATUS_META[status as TransferRequestStatus]
    : TRANSFER_ITEM_STATUS_META[status as TransferItemStatus];

  if (!meta) return <Badge variant="outline">{status}</Badge>;

  return (
    <Badge variant="outline" className={`${meta.color} border ${className}`}>
      {meta.label}
    </Badge>
  );
}
