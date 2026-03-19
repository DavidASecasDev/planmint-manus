import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Reminder, RecurrenceType, RECURRENCE_TYPE_OPTIONS } from '@/types/reminders';

interface ReminderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    remind_at: string;
    recurrence_type: RecurrenceType;
    recurrence_interval?: number;
    is_active?: boolean;
  }) => Promise<void>;
  reminder?: Reminder | null;
  isLoading?: boolean;
}

export function ReminderForm({
  open,
  onOpenChange,
  onSubmit,
  reminder,
  isLoading = false,
}: ReminderFormProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('09:00');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('once');
  const [interval, setInterval] = useState(1);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (reminder) {
      const remindDate = new Date(reminder.remind_at);
      setDate(remindDate);
      setTime(format(remindDate, 'HH:mm'));
      setRecurrenceType(reminder.recurrence_type as RecurrenceType);
      setInterval(reminder.recurrence_interval || 1);
      setIsActive(reminder.is_active);
    } else {
      setDate(undefined);
      setTime('09:00');
      setRecurrenceType('once');
      setInterval(1);
      setIsActive(true);
    }
  }, [reminder, open]);

  const handleSubmit = async () => {
    if (!date) return;

    const [hours, minutes] = time.split(':').map(Number);
    const remindAt = new Date(date);
    remindAt.setHours(hours, minutes, 0, 0);

    await onSubmit({
      remind_at: remindAt.toISOString(),
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceType === 'once' ? undefined : interval,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {reminder ? 'Editar recordatorio' : 'Nuevo recordatorio'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: es }) : 'Selecciona una fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Hora</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Recurrencia</Label>
            <Select
              value={recurrenceType}
              onValueChange={(value) => setRecurrenceType(value as RecurrenceType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recurrenceType !== 'once' && (
            <div className="grid gap-2">
              <Label>
                Intervalo (cada {interval}{' '}
                {recurrenceType === 'daily'
                  ? interval === 1 ? 'día' : 'días'
                  : recurrenceType === 'weekly'
                  ? interval === 1 ? 'semana' : 'semanas'
                  : interval === 1 ? 'mes' : 'meses'}
                )
              </Label>
              <Input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          )}

          {reminder && (
            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Recordatorio activo</Label>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!date || isLoading}>
            {isLoading ? 'Guardando...' : reminder ? 'Guardar cambios' : 'Crear recordatorio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
