import { Truck, Package, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OperationType } from '@/types/operations';

interface OperationBadgeProps {
  operationType: OperationType;
  className?: string;
}

export function OperationBadge({ operationType, className }: OperationBadgeProps) {
  const config = {
    delivery: {
      label: 'Entrega',
      icon: Truck,
      variant: 'default' as const,
    },
    pickup: {
      label: 'Recogida',
      icon: Package,
      variant: 'secondary' as const,
    },
    swap: {
      label: 'Cambio',
      icon: Repeat,
      variant: 'outline' as const,
    },
  };

  const { label, icon: Icon, variant } = config[operationType];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}
