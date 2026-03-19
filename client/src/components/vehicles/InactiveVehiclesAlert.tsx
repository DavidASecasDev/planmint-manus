import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface InactiveVehiclesAlertProps {
  count: number;
  onReview: () => void;
}

export function InactiveVehiclesAlert({ count, onReview }: InactiveVehiclesAlertProps) {
  if (count === 0) return null;

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-foreground">
          <strong>{count}</strong> vehículo{count !== 1 ? 's' : ''} sin actividad en 6+ meses
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onReview}
          className="ml-4"
        >
          Revisar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
