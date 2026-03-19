import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRepairs } from '@/hooks/useRepairs';
import type { Repair } from '@/types/garatech';

interface RepairDatesDialogProps {
  repair: Repair;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepairDatesDialog({ repair, open, onOpenChange }: RepairDatesDialogProps) {
  const { updateRepair } = useRepairs();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    repair.scheduled_date ? new Date(repair.scheduled_date) : undefined
  );
  const [startedAt, setStartedAt] = useState<Date | undefined>(
    repair.started_at ? new Date(repair.started_at) : undefined
  );
  const [completedAt, setCompletedAt] = useState<Date | undefined>(
    repair.completed_at ? new Date(repair.completed_at) : undefined
  );
  const [costFinal, setCostFinal] = useState<string>(
    repair.cost_final?.toString() || ''
  );

  // Reset form when repair changes or dialog opens
  useEffect(() => {
    if (open) {
      setScheduledDate(repair.scheduled_date ? new Date(repair.scheduled_date) : undefined);
      setStartedAt(repair.started_at ? new Date(repair.started_at) : undefined);
      setCompletedAt(repair.completed_at ? new Date(repair.completed_at) : undefined);
      setCostFinal(repair.cost_final?.toString() || '');
    }
  }, [repair, open]);

  const handleSubmit = async () => {
    // Validate dates
    if (startedAt && completedAt && startedAt > completedAt) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateRepair.mutateAsync({
        id: repair.id,
        data: {
          scheduled_date: scheduledDate?.toISOString().split('T')[0] || null,
          started_at: startedAt?.toISOString() || null,
          completed_at: completedAt?.toISOString() || null,
          cost_final: costFinal ? parseFloat(costFinal) : null,
        },
      });
      toast.success('Fechas y coste actualizados');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating repair dates:', error);
      toast.error('Error al actualizar las fechas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const DatePickerField = ({
    label,
    icon,
    value,
    onChange,
  }: {
    label: string;
    icon: React.ReactNode;
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd MMM yyyy', { locale: es }) : 'Seleccionar fecha'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            locale={es}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Editar Fechas y Coste
          </DialogTitle>
          <DialogDescription>
            Modifica las fechas de programación, inicio, finalización y el coste final de la reparación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DatePickerField
            label="Fecha Programada"
            icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />}
            value={scheduledDate}
            onChange={setScheduledDate}
          />

          <DatePickerField
            label="Fecha de Inicio"
            icon={<div className="h-4 w-4 rounded-full bg-blue-500" />}
            value={startedAt}
            onChange={setStartedAt}
          />

          <DatePickerField
            label="Fecha de Finalización"
            icon={<div className="h-4 w-4 rounded-full bg-green-500" />}
            value={completedAt}
            onChange={setCompletedAt}
          />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <span className="text-lg">€</span>
              Coste Final
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={costFinal}
              onChange={(e) => setCostFinal(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Estos cambios quedarán registrados en el historial de la reparación.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
