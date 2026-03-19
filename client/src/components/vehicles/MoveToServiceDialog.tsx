import { useState } from 'react';
import { ServiceType } from '@/types/vehicles';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Wrench, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MoveToServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (serviceType: ServiceType, notes: string) => void;
  matricula: string;
  isLoading?: boolean;
}

export function MoveToServiceDialog({
  open,
  onOpenChange,
  onConfirm,
  matricula,
  isLoading,
}: MoveToServiceDialogProps) {
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (selectedType) {
      onConfirm(selectedType, notes);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedType(null);
      setNotes('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover a En Servicio</DialogTitle>
          <DialogDescription>
            Selecciona el motivo para {matricula}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedType('reparacion')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                selectedType === 'reparacion'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                  : 'border-border hover:border-muted-foreground/50'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                selectedType === 'reparacion' 
                  ? 'bg-purple-100 dark:bg-purple-900' 
                  : 'bg-muted'
              )}>
                <Wrench className={cn(
                  'h-6 w-6',
                  selectedType === 'reparacion' ? 'text-purple-600' : 'text-muted-foreground'
                )} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Reparación</p>
                <p className="text-xs text-muted-foreground">En taller</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('bloqueo')}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                selectedType === 'bloqueo'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950'
                  : 'border-border hover:border-muted-foreground/50'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                selectedType === 'bloqueo' 
                  ? 'bg-orange-100 dark:bg-orange-900' 
                  : 'bg-muted'
              )}>
                <Lock className={cn(
                  'h-6 w-6',
                  selectedType === 'bloqueo' ? 'text-orange-600' : 'text-muted-foreground'
                )} />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Bloqueo</p>
                <p className="text-xs text-muted-foreground">Disponibilidad</p>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Textarea
              placeholder="Motivo del servicio o bloqueo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedType || isLoading}
          >
            {isLoading ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
