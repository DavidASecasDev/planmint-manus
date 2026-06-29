import { useState, useEffect } from 'react';
import { Euro } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Repair } from '@/types/garatech';

interface FinalizarRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repair: Repair | null;
  onConfirm: (repair: Repair, costFinal: number | null) => void;
  loading?: boolean;
}

export function FinalizarRepairDialog({
  open,
  onOpenChange,
  repair,
  onConfirm,
  loading = false,
}: FinalizarRepairDialogProps) {
  const [costValue, setCostValue] = useState('');

  // Pre-fill with cost_estimate if available
  useEffect(() => {
    if (open && repair) {
      setCostValue(
        repair.cost_final
          ? repair.cost_final.toString()
          : repair.cost_estimate
            ? repair.cost_estimate.toString()
            : ''
      );
    }
  }, [open, repair]);

  const handleConfirm = () => {
    if (!repair) return;
    const parsed = parseFloat(costValue.replace(',', '.'));
    const costFinal = isNaN(parsed) ? null : Math.round(parsed * 100) / 100;
    onConfirm(repair, costFinal);
  };

  if (!repair) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Finalizar reparación</DialogTitle>
          <DialogDescription>
            Confirma la finalización de la reparación de{' '}
            <span className="font-semibold">{repair.vehicle?.matricula || 'este vehículo'}</span>.
            Introduce el coste final si lo conoces.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cost estimate reference */}
          {repair.cost_estimate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Euro className="h-4 w-4" />
              <span>Coste estimado: <span className="font-mono font-medium text-foreground">{repair.cost_estimate.toLocaleString('es-ES')}€</span></span>
            </div>
          )}

          {/* Cost final input */}
          <div className="space-y-2">
            <Label htmlFor="cost-final">Coste final (€)</Label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="cost-final"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={costValue}
                onChange={(e) => setCostValue(e.target.value)}
                className="pl-9 font-mono"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Deja vacío si aún no conoces el coste final.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Finalizando...' : 'Finalizar reparación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
