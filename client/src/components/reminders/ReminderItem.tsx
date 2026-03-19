import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Edit2, Trash2, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Reminder, getRecurrenceLabel } from '@/types/reminders';

interface ReminderItemProps {
  reminder: Reminder;
  canEdit: boolean;
  onEdit: (reminder: Reminder) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
}

export function ReminderItem({
  reminder,
  canEdit,
  onEdit,
  onToggle,
  onDelete,
}: ReminderItemProps) {
  const remindDate = new Date(reminder.remind_at);
  const isExpired = isPast(remindDate);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      !reminder.is_active ? 'opacity-60 bg-muted/50' : isExpired ? 'bg-destructive/10 border-destructive/30' : 'bg-card'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${
          !reminder.is_active ? 'bg-muted' : isExpired ? 'bg-destructive/20' : 'bg-primary/10'
        }`}>
          {reminder.is_active ? (
            <Bell className={`h-4 w-4 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {isExpired ? 'Vencido el ' : ''}
              {format(remindDate, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
            </span>
            {!reminder.is_active && (
              <Badge variant="secondary" className="text-xs">
                Inactivo
              </Badge>
            )}
            {isExpired && reminder.is_active && (
              <Badge variant="destructive" className="text-xs">
                Vencido
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {getRecurrenceLabel(reminder.recurrence_type, reminder.recurrence_interval)}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Switch
            checked={reminder.is_active}
            onCheckedChange={(checked) => onToggle(reminder.id, checked)}
            aria-label={reminder.is_active ? 'Desactivar' : 'Activar'}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(reminder)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar recordatorio?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(reminder.id)}>
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
