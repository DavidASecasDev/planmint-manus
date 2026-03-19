import { useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useReminders } from '@/hooks/useReminders';
import { ReminderForm } from './ReminderForm';
import { ReminderItem } from './ReminderItem';
import { Reminder, RecurrenceType } from '@/types/reminders';

interface RemindersSectionProps {
  taskId: string;
  canEdit: boolean;
}

export function RemindersSection({ taskId, canEdit }: RemindersSectionProps) {
  const { reminders, loading, createReminder, updateReminder, toggleReminder, deleteReminder } = useReminders(taskId);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: {
    remind_at: string;
    recurrence_type: RecurrenceType;
    recurrence_interval?: number;
    is_active?: boolean;
  }) => {
    setIsSubmitting(true);
    try {
      if (editingReminder) {
        await updateReminder(editingReminder.id, data);
      } else {
        await createReminder({
          task_id: taskId,
          remind_at: data.remind_at,
          recurrence_type: data.recurrence_type,
          recurrence_interval: data.recurrence_interval,
        });
      }
      setFormOpen(false);
      setEditingReminder(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormOpen(true);
  };

  const handleCloseForm = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingReminder(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recordatorios
          </h3>
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Recordatorios
          {reminders.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({reminders.length})
            </span>
          )}
        </h3>
        {canEdit && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        )}
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Esta tarea no tiene recordatorios configurados.</p>
          {canEdit && (
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => setFormOpen(true)}
            >
              Añadir un recordatorio
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <ReminderItem
              key={reminder.id}
              reminder={reminder}
              canEdit={canEdit}
              onEdit={handleEdit}
              onToggle={toggleReminder}
              onDelete={deleteReminder}
            />
          ))}
        </div>
      )}

      <ReminderForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        onSubmit={handleSubmit}
        reminder={editingReminder}
        isLoading={isSubmitting}
      />
    </div>
  );
}
